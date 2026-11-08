import collections
from datetime import datetime, timezone
import logging
import os
import re
import sys
import threading
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

# In-memory ring buffer for HTTP-accessible logs (up to 1 000 entries)
LOG_BUFFER: collections.deque[Dict[str, Any]] = collections.deque(maxlen=1000)
LOG_BUFFER_LOCK = threading.Lock()


class _LogCaptureHandler(logging.Handler):
    """Handler that captures log records into the in-memory ring buffer."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "message": self.format(record),
                "service": "woob",
            }
            with LOG_BUFFER_LOCK:
                LOG_BUFFER.append(entry)
        except Exception:
            pass


# Configure logging
log_format = "%(asctime)s [%(levelname)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger("woob-service")

# Attach ring buffer capture handler to root logger and uvicorn
capture_handler = _LogCaptureHandler()
capture_handler.setFormatter(logging.Formatter(log_format))
logging.getLogger().addHandler(capture_handler)
logging.getLogger("uvicorn").addHandler(capture_handler)
logging.getLogger("uvicorn.access").addHandler(capture_handler)

app = FastAPI(title="Sigma Finance Woob Sidecar", version="1.0.0")

# In-memory session and backend cache
# session_id -> { "backend": backend_obj, "institution": str, "status": str, "expires_at": float, "credentials": dict }
sessions: Dict[str, Dict[str, Any]] = {}
SESSION_LOCKS: Dict[str, threading.Lock] = {}

# Try importing Woob
WOOB_AVAILABLE = False
try:
    from woob.core import Woob
    from woob.capabilities.bank import CapBank, Account
    from woob.capabilities.base import empty, NotLoaded
    from woob.exceptions import (
        ActionNeeded,
        AppValidation,
        BrowserIncorrectPassword,
        BrowserPasswordExpired,
        BrowserQuestion,
        BrowserUnavailable,
        ModuleLoadError,
        NeedInteractive,
        NeedInteractiveFor2FA,
        OTPQuestion,
        SentOTPQuestion,
    )
    WOOB_AVAILABLE = True
    logger.info("Woob core and CapBank successfully imported")
except ImportError as e:
    def empty(val):
        return val is None
    NotLoaded = None
    class ActionNeeded(Exception): pass
    class AppValidation(Exception): pass
    class BrowserQuestion(Exception): pass
    class BrowserIncorrectPassword(Exception): pass
    class BrowserPasswordExpired(Exception): pass
    class BrowserUnavailable(Exception): pass
    class ModuleLoadError(Exception): pass
    class NeedInteractive(Exception): pass
    class NeedInteractiveFor2FA(Exception): pass
    class OTPQuestion(Exception): pass
    class SentOTPQuestion(Exception): pass
    logger.warning("Woob not available in runtime environment (%s). Running in test/mock mode.", e)


def safe_str(val: Any, default: Optional[str] = None) -> Optional[str]:
    if val is None or empty(val):
        return default
    s = str(val).strip()
    return s if s else default


def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or empty(val):
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# Supported French and European bank modules in Woob
MODULE_MAP: Dict[str, str] = {
    "boursorama": "boursorama",
    "boursobank": "boursorama",
    "fortuneo": "fortuneo",
    "caissedepargne": "caissedepargne",
    "caisse_epargne": "caissedepargne",
    "creditagricole": "creditagricole",
    "credit_agricole": "creditagricole",
    "bnp": "bnporc",
    "bnpparibas": "bnporc",
    "societegenerale": "societegenerale",
    "societe_generale": "societegenerale",
    "creditmutuel": "creditmutuel",
    "credit_mutuel": "creditmutuel",
    "cic": "cic",
    "labanquepostale": "labanquepostale",
    "banquepostale": "labanquepostale",
    "lcl": "lcl",
    "banquepopulaire": "banquepopulaire",
    "banque_populaire": "banquepopulaire",
    "hellobank": "hellobank",
    "bforbank": "bforbank",
    "boursedirect": "boursedirect",
    "amundi": "amundi",
    "linxea": "linxea",
    "yomoni": "yomoni",
    "ing": "ing",
    "revolut": "revolut",
    "n26": "n26",
    "degiro": "degiro",
}


def resolve_module_name(inst_input: str) -> str:
    cleaned = inst_input.strip().lower().replace(" ", "").replace("-", "")
    return MODULE_MAP.get(cleaned, cleaned)


CAISSE_EPARGNE_REGIONS: Dict[str, str] = {
    "grand_est": "15135",
    "grandest": "15135",
    "cee": "15135",
    "cegee": "15135",
    "idf": "17515",
    "ile_de_france": "17515",
    "ceidf": "17515",
    "rhone_alpes": "13825",
    "rhonealpes": "13825",
    "cera": "13825",
    "aquitaine": "13335",
    "ceapc": "13335",
    "nord": "16275",
    "hauts_de_france": "16275",
    "cehdf": "16275",
    "paca": "18315",
    "cote_azur": "18315",
    "cepac": "11315",
    "bourgogne": "12135",
    "cebfc": "12135",
    "bretagne": "14445",
    "cebpl": "14445",
    "languedoc": "13485",
    "celr": "13485",
    "loire_centre": "14505",
    "celc": "14505",
    "loire_drome": "14265",
    "celda": "14265",
    "midi_pyrenees": "13135",
    "cemp": "13135",
    "normandie": "11425",
    "cen": "11425",
    "auvergne": "18715",
    "cepal": "18715",
}


def patch_caissedepargne_module() -> None:
    if not WOOB_AVAILABLE:
        return
    try:
        from woob_modules.caissedepargne.browser import CaisseEpargne, CaisseEpargneLogin
        from woob_modules.caissedepargne.pages import ConfigPage
        from woob.browser.url import URL
        from woob.browser.exceptions import ClientError
        from woob.exceptions import AppValidationExpired

        # BPCE / Caisse d'Épargne moved config.json to icgauth domain, causing 403 on caisse-epargne.fr
        CaisseEpargneLogin.config_page = URL(
            r"https://www.icgauth.caisse-epargne.fr/ria/pas/configuration/config.json\?ts=(?P<timestamp>.*)",
            ConfigPage,
        )

        # Patch get_continue_url to avoid raising empty BrowserIncorrectPassword() when cdetab is missing or unmapped
        def safe_get_continue_url(self, cdetab, user_type):
            dei = self.doc.get("continueUrls", {}).get("dei", {})
            cdetab_str = str(cdetab) if cdetab else ""
            continue_url = dei.get(cdetab_str)
            if not continue_url and dei:
                logger.warning("cdetab '%s' not found in continueUrls dei, attempting default region fallback", cdetab)
                continue_url = dei.get("15135") or next(iter(dei.values()), None)
            if not continue_url:
                raise BrowserIncorrectPassword("Caisse régionale Caisse d'Épargne non reconnue. Veuillez vérifier vos identifiants ou sélectionner votre caisse régionale.")
            return continue_url.get(user_type) or continue_url.get("part") or continue_url.get("pro")

        ConfigPage.get_continue_url = safe_get_continue_url

        # Patch do_cloudcard_authentication: WaitingCallbackHandler can return 401/403 while app notification is pending
        original_do_cloudcard = CaisseEpargne.do_cloudcard_authentication

        def safe_do_cloudcard_authentication(self, **params):
            if not self.otp_validation:
                self.otp_validation = getattr(self, "login_otp_validation", None)
            assert self.otp_validation, "otp_validation is required"
            timeout = time.time() + 180.0
            referer_url = self.authentication_method_page.build(
                domain=self.validation_domain,
                validation_id=self.validation_id,
            )

            while time.time() < timeout:
                try:
                    self.app_validation.go(
                        domain=self.validation_domain,
                        headers={"Referer": referer_url},
                    )
                    status = self.page.get_status()
                    if status == "valid":
                        self.authentication_step.go(
                            domain=self.validation_domain,
                            validation_id=self.validation_id,
                            json={
                                "validate": {
                                    self.otp_validation["validation_unit_id"]: [
                                        {
                                            "id": self.otp_validation["id"],
                                            "type": "CLOUDCARD",
                                        },
                                    ],
                                },
                            },
                        )
                        break
                except ClientError as e:
                    # 403 / 401 occurs while waiting for mobile app approval, keep polling
                    logger.debug("WaitingCallbackHandler pending (%s), waiting for user tap in app...", e)

                time.sleep(2)
            else:
                raise AppValidationExpired()

            self.otp_validation = None

        CaisseEpargne.do_cloudcard_authentication = safe_do_cloudcard_authentication

        # Patch handle_polling: after do_cloudcard_authentication, we are on authentication_step,
        # so calling handle_steps_login() fails assertion. Call end_step_process directly.
        def safe_handle_polling(self):
            if not self.otp_validation:
                self.otp_validation = getattr(self, "login_otp_validation", None)
            self.handle_step_validation("CLOUDCARD", "login")
            if hasattr(self, "authentication_method_page") and self.authentication_method_page.is_here():
                self.handle_steps_login()
            else:
                self.end_step_process()
            self.login_finalize()
            self.login_otp_validation = None
            self.logged = True
            if hasattr(self, "page") and self.page:
                self.page.logged = True

        CaisseEpargne.handle_polling = safe_handle_polling

        # Patch get_loans_token to prevent crash when BPCE consumer credits client_id changes
        original_get_loans_token = CaisseEpargne.get_loans_token

        def safe_get_loans_token(self, account_type):
            try:
                return original_get_loans_token(self, account_type)
            except Exception as e:
                logger.warning("Consumer credits/loans token failed (%s), bypassing loan details to prevent crash", e)
                return None

        CaisseEpargne.get_loans_token = safe_get_loans_token

        # Resilient implementation of CaisseEpargne.iter_accounts
        # Isolate loan and card detail calls so that 401/403 ClientErrors do not discard core accounts (checking, savings, PEA)
        def resilient_iter_accounts(self):
            self.logged = True
            params = {
                "productFamilyPFM": "1,2,3,4,6,7,17",
                "pfmCharacteristicsIndicator": "true",
            }
            try:
                self.accounts_page.go(params=params)
            except Exception as e:
                logger.error("Failed to navigate to accounts_page: %s", e)
                raise

            accounts = []
            cards = []

            # 1. Base bank accounts (checking, savings, PEA, etc.)
            try:
                for account in self.page.iter_accounts():
                    accounts.append(account)
                    if getattr(account, "_has_card", False):
                        try:
                            cards.extend(self.page.iter_cards(parent_account=account))
                        except Exception as e:
                            logger.warning("Could not iter cards for account %s: %s", getattr(account, "id", ""), e)
            except Exception as e:
                logger.error("Error reading base accounts: %s", e)
                raise

            # 2. Loans & consumer credits (resilient to 401/403/token errors)
            try:
                for loan in self.page.iter_loans():
                    loan_type = getattr(loan, "type", None)
                    try:
                        if loan_type == Account.TYPE_REVOLVING_CREDIT:
                            self.revolving_details.go(revolving_id=loan.id)
                            self.page.fill_revolving_details(obj=loan)
                        elif loan_type == Account.TYPE_CONSUMER_CREDIT:
                            token = self.get_loans_token("consumer_credits")
                            if token:
                                self.consumer_credit_details.go(
                                    consumer_credit_id=loan.id, headers={"Authorization": token}
                                )
                                self.page.fill_consumer_credit_details(obj=loan)
                        elif loan_type == Account.TYPE_LOAN:
                            token = self.get_loans_token("loans")
                            if token:
                                self.loan_details.go(
                                    loan_id=getattr(loan, "_website_id", loan.id),
                                    headers={"Authorization": token},
                                )
                                self.page.fill_loan_details(obj=loan)
                    except Exception as e:
                        logger.warning("Failed to fetch detailed schedule for loan %s (%s), keeping base loan object", getattr(loan, "id", ""), e)
                    accounts.append(loan)
            except Exception as e:
                logger.warning("Error iterating loans: %s", e)

            # 3. Cards details
            if cards:
                try:
                    self.cards_page.go(params={"userId": "currentUser"})
                    for card in cards:
                        try:
                            self.page.fill_cards(card)
                        except Exception:
                            pass
                        if not getattr(card, "id", None):
                            card.id = getattr(card, "_details_id", str(uuid.uuid4()))
                    accounts.extend(cards)
                except Exception as e:
                    logger.warning("Error fetching detailed cards: %s", e)
                    accounts.extend(cards)

            self.logged = True
            if hasattr(self, "page") and self.page:
                self.page.logged = True

            return accounts

        CaisseEpargne.iter_accounts = resilient_iter_accounts

        # Ensure ProxyBrowser propagates logged status
        from woob_modules.caissedepargne.proxy_browser import ProxyBrowser
        if not hasattr(ProxyBrowser, "logged"):
            ProxyBrowser.logged = property(lambda self: getattr(self._browser, "logged", False) if hasattr(self, "_browser") and self._browser else False)

        logger.info("Patched Caisse d'Épargne module (config_page, safe CloudCard polling, resilient loans/accounts, logged property)")
    except Exception as e:
        logger.debug("caissedepargne patch skipped: %s", e)


def extract_error_message(e: Exception) -> str:
    msg = str(e).strip()
    if msg and not msg.startswith("<class") and not msg.startswith("400:"):
        return msg
    if msg.startswith("400:"):
        return msg[4:].strip()

    err_type = type(e).__name__
    if isinstance(e, BrowserIncorrectPassword) or "BrowserIncorrectPassword" in err_type:
        return "Identifiant ou code confidentiel bancaire incorrect pour cet établissement."
    if isinstance(e, BrowserUnavailable) or "BrowserUnavailable" in err_type:
        return "Le portail bancaire est temporairement indisponible. Veuillez réessayer ultérieurement."
    if isinstance(e, BrowserPasswordExpired) or "BrowserPasswordExpired" in err_type:
        return "Votre code d'accès bancaire a expiré. Veuillez le renouveler sur le site de votre banque."
    if isinstance(e, (NeedInteractiveFor2FA, NeedInteractive)) or "NeedInteractive" in err_type:
        return "Validation d'authentification forte (2FA) requise par votre banque."
    if isinstance(e, AppValidation) or "AppValidation" in err_type:
        return "Veuillez valider la notification de connexion sur votre application mobile bancaire."
    if isinstance(e, (ActionNeeded, BrowserQuestion)) or "ActionNeeded" in err_type or "Question" in err_type:
        return "Validation de sécurité ou saisie d'un code SMS requise."
    if isinstance(e, ModuleLoadError) or "ModuleLoadError" in err_type:
        return f"Erreur de chargement du module bancaire: {err_type}"
    return f"Erreur de connexion bancaire ({err_type})"


def ensure_module_installed(w: Any, mod_name: str) -> None:
    if not WOOB_AVAILABLE:
        return
    try:
        w.modules_loader.get_or_load_module(mod_name)
    except ModuleLoadError:
        logger.info("Module %s not installed locally. Installing from repository...", mod_name)
        w.repositories.install(mod_name)
        w.modules_loader.get_or_load_module(mod_name)

    if mod_name in ("caissedepargne", "caisse_epargne"):
        patch_caissedepargne_module()


# Models
class LoginRequest(BaseModel):
    institution: str
    login: str
    password: str
    region: Optional[str] = None


class LoginResponse(BaseModel):
    session_id: str
    status: str  # "SUCCESS" | "WAITING_FOR_CONFIRMATION" | "WAITING_FOR_CODE" | "REJECTED" | "EXPIRED"
    countdown_seconds: int
    challenge_message: Optional[str] = None
    expires_at: int


class PollRequest(BaseModel):
    session_id: str
    otp_code: Optional[str] = None


class PollResponse(BaseModel):
    status: str  # "SUCCESS" | "WAITING_FOR_CONFIRMATION" | "WAITING_FOR_CODE" | "REJECTED" | "EXPIRED"
    message: Optional[str] = None
    expires_at: int


class AccountItem(BaseModel):
    external_id: str
    name: str
    type: str  # "market" | "loan" | "checking" | "savings"
    currency: str
    balance: float
    iban: Optional[str] = None
    account_number: Optional[str] = None


class AccountsRequest(BaseModel):
    session_id: str


class InvestmentItem(BaseModel):
    isin: str
    code: Optional[str] = None
    symbol: Optional[str] = None
    name: str
    quantity: float
    unit_value: float
    valuation: float
    diff: Optional[float] = 0.0


class InvestmentsRequest(BaseModel):
    session_id: str
    external_account_id: str


class LoanDetails(BaseModel):
    total_amount: float
    remaining_balance: float
    interest_rate: float
    monthly_payment: float
    next_payment_date: Optional[str] = None
    maturity_date: Optional[str] = None


class LoanRequest(BaseModel):
    session_id: str
    external_account_id: str


class TransactionItem(BaseModel):
    external_id: str
    name: str
    amount: float
    currency: str
    date: str
    raw: Optional[str] = None


class TransactionsRequest(BaseModel):
    session_id: str
    external_account_id: str


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "woob-service",
        "woob_available": WOOB_AVAILABLE,
        "active_sessions": len(sessions),
    }


@app.get("/logs")
def get_logs(
    limit: int = 200,
    filter: Optional[str] = None,
    level: Optional[str] = None,
):
    with LOG_BUFFER_LOCK:
        entries = list(LOG_BUFFER)

    if filter:
        filter_lower = filter.lower()
        entries = [e for e in entries if filter_lower in e["message"].lower()]
    if level:
        level_upper = level.upper()
        entries = [e for e in entries if e["level"] == level_upper]

    entries = entries[-limit:]
    return {"logs": entries, "total": len(entries)}


@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    session_id = str(uuid.uuid4())
    countdown = 120
    expires_at = int(time.time()) + countdown

    # Mock / Demo fallback if woob isn't installed or if mock login is requested
    is_demo = req.login.lower() in ["demo", "test", "test_user"] or not WOOB_AVAILABLE

    if is_demo:
        sessions[session_id] = {
            "institution": req.institution.lower(),
            "status": "SUCCESS",
            "expires_at": expires_at,
            "mock": True,
            "credentials": {"login": req.login, "region": req.region},
        }
        return LoginResponse(
            session_id=session_id,
            status="SUCCESS",
            countdown_seconds=countdown,
            challenge_message="Connected via test mode",
            expires_at=expires_at,
        )

    # Real Woob connection
    try:
        w = Woob()
        mod_name = resolve_module_name(req.institution)
        ensure_module_installed(w, mod_name)
        backend_params = {
            "login": req.login,
            "password": req.password,
            "request_information": {},
        }
        if req.region:
            backend_params["region"] = req.region

        is_caisse = mod_name in ("caissedepargne", "caisse_epargne")
        if is_caisse:
            backend_params["auth_type"] = "part"
            if req.region:
                reg_clean = req.region.lower().strip()
                cdetab = CAISSE_EPARGNE_REGIONS.get(reg_clean)
                if cdetab:
                    backend_params["bank_id"] = cdetab

        backend = w.build_backend(mod_name, backend_params)

        browser = getattr(backend, "browser", None)
        if browser:
            # Enable interactive MFA so woob triggers 2FA questions/app validation rather than aborting
            browser.is_interactive = True
            if is_caisse:
                browser.connection_type = "part"
                if req.region:
                    reg_clean = req.region.lower().strip()
                    cdetab = CAISSE_EPARGNE_REGIONS.get(reg_clean)
                    if cdetab:
                        browser.cdetab = cdetab

        # Trigger login check by attempting iter_accounts
        try:
            accounts_iter = backend.iter_accounts()
            first_account = None
            try:
                first_account = next(iter(accounts_iter), None)
            except StopIteration:
                first_account = None

            sessions[session_id] = {
                "institution": req.institution.lower(),
                "backend": backend,
                "status": "SUCCESS",
                "expires_at": expires_at,
                "mock": False,
                "first_account": first_account,
            }
            return LoginResponse(
                session_id=session_id,
                status="SUCCESS",
                countdown_seconds=countdown,
                expires_at=expires_at,
            )
        except AppValidation as e:
            logger.info("Bank requires mobile app push validation: %s", e)
            sessions[session_id] = {
                "institution": req.institution.lower(),
                "backend": backend,
                "status": "WAITING_FOR_CONFIRMATION",
                "expires_at": expires_at,
                "mock": False,
            }
            challenge_msg = str(e).strip() or "Veuillez valider la notification sur votre application bancaire mobile"
            return LoginResponse(
                session_id=session_id,
                status="WAITING_FOR_CONFIRMATION",
                countdown_seconds=countdown,
                challenge_message=challenge_msg,
                expires_at=expires_at,
            )
        except (SentOTPQuestion, OTPQuestion, ActionNeeded, BrowserQuestion) as e:
            logger.info("Bank requires interactive OTP code or user action: %s", e)
            sessions[session_id] = {
                "institution": req.institution.lower(),
                "backend": backend,
                "status": "WAITING_FOR_CODE",
                "expires_at": expires_at,
                "mock": False,
            }
            challenge_msg = str(e).strip() or "Veuillez saisir le code de sécurité reçu"
            return LoginResponse(
                session_id=session_id,
                status="WAITING_FOR_CODE",
                countdown_seconds=countdown,
                challenge_message=challenge_msg,
                expires_at=expires_at,
            )
        except (NeedInteractiveFor2FA, NeedInteractive) as e:
            logger.info("Bank requires interactive 2FA: %s", e)
            sessions[session_id] = {
                "institution": req.institution.lower(),
                "backend": backend,
                "status": "WAITING_FOR_CONFIRMATION",
                "expires_at": expires_at,
                "mock": False,
            }
            return LoginResponse(
                session_id=session_id,
                status="WAITING_FOR_CONFIRMATION",
                countdown_seconds=countdown,
                challenge_message="Veuillez valider la connexion sur votre application mobile bancaire ou saisir le code de sécurité.",
                expires_at=expires_at,
            )
        except BrowserIncorrectPassword as e:
            logger.warning("Incorrect password for bank: %s", e)
            err_msg = str(e).strip() or "Identifiant ou mot de passe bancaire incorrect pour cet établissement."
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            )
        except BrowserUnavailable as e:
            logger.warning("Bank website unavailable: %s", e)
            err_msg = str(e).strip() or "Le portail de votre banque est temporairement indisponible. Veuillez réessayer un peu plus tard."
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg,
            )
        except ValueError as e:
            if "does not match regexp" in str(e) and r"\d+" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le mot de passe / code d'accès pour cet établissement doit être composé uniquement de chiffres.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erreur de validation des identifiants: {str(e)}",
            )
        except ModuleLoadError as e:
            logger.error("Module load error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erreur de chargement du module bancaire: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to build woob backend or execute login: %s", e, exc_info=True)
        err_msg = extract_error_message(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erreur de connexion bancaire: {err_msg}",
        )


@app.post("/api/v1/auth/poll", response_model=PollResponse)
def poll_auth(req: PollRequest):
    sess = sessions.get(req.session_id)
    if not sess:
        return PollResponse(
            status="EXPIRED",
            message="Session d'authentification expirée ou introuvable",
            expires_at=int(time.time()),
        )

    if time.time() > sess["expires_at"]:
        sess["status"] = "EXPIRED"
        return PollResponse(
            status="EXPIRED",
            message="Délai d'authentification dépassé",
            expires_at=sess["expires_at"],
        )

    # In mock mode, immediately complete
    if sess.get("mock"):
        sess["status"] = "SUCCESS"
        return PollResponse(
            status="SUCCESS",
            message="Authentification réussie",
            expires_at=sess["expires_at"],
        )

    # If backend was waiting for confirmation, test iter_accounts again
    backend = sess.get("backend")
    if not backend:
        return PollResponse(status="REJECTED", message="Backend indisponible", expires_at=sess["expires_at"])

    # Prevent concurrent HTTP polls on the same session from racing on the same Woob browser
    lock = SESSION_LOCKS.setdefault(req.session_id, threading.Lock())
    if not lock.acquire(blocking=False):
        return PollResponse(
            status="WAITING_FOR_CONFIRMATION",
            message="Validation en cours sur votre mobile...",
            expires_at=sess["expires_at"],
        )

    try:
        # If OTP code is submitted, pass it to the backend config/browser
        if req.otp_code and req.otp_code.strip():
            code = req.otp_code.strip()
            try:
                if hasattr(backend, "config"):
                    if "otp_sms" in backend.config:
                        backend.config["otp_sms"].set(code)
                    elif "request_information" in backend.config:
                        backend.config["request_information"].set(code)
                browser = getattr(backend, "browser", None)
                if browser and hasattr(browser, "handle_otp_sms"):
                    browser.handle_otp_sms(otp_sms=code)
            except Exception as e:
                logger.warning("Error supplying OTP code to backend: %s", e)

        # If polling for push validation on mobile app, signal resume if supported
        if hasattr(backend, "config") and "resume" in backend.config:
            backend.config["resume"].set("true")

        try:
            # Check if login completed and retrieve accounts
            raw_accounts = []
            for acc in backend.iter_accounts():
                raw_accounts.append(acc)

            if not raw_accounts:
                logger.info("iter_accounts returned empty list during poll, keeping WAITING_FOR_CONFIRMATION")
                return PollResponse(
                    status="WAITING_FOR_CONFIRMATION",
                    message="En attente de validation sur votre application mobile...",
                    expires_at=sess["expires_at"],
                )

            mapped_accounts = [map_woob_account(acc) for acc in raw_accounts]
            sess["cached_accounts"] = mapped_accounts
            sess["status"] = "SUCCESS"
            return PollResponse(status="SUCCESS", message="Authentification validée", expires_at=sess["expires_at"])
        except AppValidation:
            return PollResponse(
                status="WAITING_FOR_CONFIRMATION",
                message="En attente de confirmation sur l'application",
                expires_at=sess["expires_at"],
            )
        except (SentOTPQuestion, OTPQuestion, ActionNeeded, BrowserQuestion) as e:
            msg = str(e).strip() or "Veuillez saisir le code de sécurité reçu"
            return PollResponse(
                status="WAITING_FOR_CODE",
                message=msg,
                expires_at=sess["expires_at"],
            )
        except BrowserIncorrectPassword as e:
            err_msg = str(e).strip() or "Code de sécurité ou mot de passe incorrect."
            logger.warning("Poll rejected due to incorrect credentials: %s", err_msg)
            return PollResponse(status="REJECTED", message=err_msg, expires_at=sess["expires_at"])
        except Exception as e:
            logger.warning("Poll error: %s (%s)", e, type(e).__name__)
            # If user is still within the active session countdown, transient HTTP errors while mobile notification
            # is pending (e.g. 403 Forbidden on WaitingCallbackHandler, or temporary AssertionErrors) must keep polling
            # rather than immediately rejecting and cancelling the user prompt.
            if time.time() < sess["expires_at"] and (
                isinstance(e, AppValidation)
                or "ClientError" in type(e).__name__
                or "Forbidden" in str(e)
                or "403" in str(e)
                or "401" in str(e)
                or "AssertionError" in type(e).__name__
            ):
                return PollResponse(
                    status="WAITING_FOR_CONFIRMATION",
                    message="En attente de validation sur votre application mobile...",
                    expires_at=sess["expires_at"],
                )
            err_msg = extract_error_message(e)
            return PollResponse(status="REJECTED", message=err_msg, expires_at=sess["expires_at"])
    finally:
        lock.release()


def map_woob_account(acc: Any) -> AccountItem:
    acc_type = "checking"
    raw_type = getattr(acc, "type", None)
    if not empty(raw_type):
        if raw_type == Account.TYPE_CHECKING:
            acc_type = "checking"
        elif raw_type in (Account.TYPE_SAVINGS, getattr(Account, "TYPE_DEPOSIT", None)):
            acc_type = "savings"
        elif raw_type == Account.TYPE_MARKET:
            acc_type = "market"
        elif raw_type == getattr(Account, "TYPE_PEA", None):
            acc_type = "pea"
        elif raw_type == getattr(Account, "TYPE_LIFE_INSURANCE", None):
            acc_type = "life_insurance"
        elif raw_type in (
            Account.TYPE_LOAN,
            getattr(Account, "TYPE_MORTGAGE", None),
            getattr(Account, "TYPE_CONSUMER_CREDIT", None),
        ):
            acc_type = "loan"
        elif raw_type == getattr(Account, "TYPE_CARD", None):
            acc_type = "card"
        elif raw_type in (
            getattr(Account, "TYPE_RETIREMENT", None),
            getattr(Account, "TYPE_PERCO", None),
            getattr(Account, "TYPE_ARTICLE_83", None),
            getattr(Account, "TYPE_RSP", None),
        ):
            acc_type = "retirement"

    iban_val = safe_str(getattr(acc, "iban", None))
    acc_id = safe_str(getattr(acc, "id", None), default="unknown")
    acc_label = safe_str(getattr(acc, "label", None), default=acc_id)
    acc_curr = safe_str(getattr(acc, "currency", None), default="EUR")
    acc_balance = safe_float(getattr(acc, "balance", 0.0), default=0.0)

    # Heuristics if Woob backend returned generic TYPE_UNKNOWN or TYPE_CHECKING
    label_upper = acc_label.upper()
    if "PEA" in label_upper:
        acc_type = "pea"
    elif any(s in label_upper for s in ["LIVRET", "LDDS", "LEP", "PEL", "CEL", "CSL", "ÉPARGNE", "EPARGNE"]):
        acc_type = "savings"
    elif any(s in label_upper for s in ["ASSURANCE", "VIE", "CAPITALISATION", "AV "]):
        acc_type = "life_insurance"
    elif any(s in label_upper for s in ["PRÊT", "PRET", "CRÉDIT", "CREDIT", "EMPRUNT", "IMMO"]):
        acc_type = "loan"
    elif "TITRES" in label_upper or "CTO" in label_upper:
        acc_type = "market"

    return AccountItem(
        external_id=acc_id,
        name=acc_label,
        type=acc_type,
        currency=acc_curr,
        balance=acc_balance,
        iban=iban_val,
        account_number=acc_id,
    )


@app.post("/api/v1/accounts", response_model=List[AccountItem])
def list_accounts(req: AccountsRequest):
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session expirée ou introuvable")

    if sess.get("mock"):
        inst = sess.get("institution", "")
        inst_label = inst.replace("_", " ").title() if inst else "Banque"
        return [
            AccountItem(
                external_id="MOCK-CHECK-001",
                name=f"Compte Courant {inst_label}",
                type="checking",
                currency="EUR",
                balance=2850.40,
                iban="FR7630004000010001234567890",
                account_number="00012345678",
            ),
            AccountItem(
                external_id="MOCK-SAV-002",
                name="Livret A",
                type="savings",
                currency="EUR",
                balance=15000.00,
                account_number="00012345679",
            ),
            AccountItem(
                external_id="MOCK-PEA-003",
                name="Plan d'Épargne en Actions (PEA)",
                type="pea",
                currency="EUR",
                balance=18097.70,
                account_number="00012345680",
            ),
            AccountItem(
                external_id="MOCK-PEA-CASH-004",
                name="PEA Espèces / Liquidités",
                type="checking",
                currency="EUR",
                balance=1450.00,
                account_number="00012345681",
            ),
            AccountItem(
                external_id="MOCK-AV-005",
                name="Contrat Assurance-Vie Multi-Supports",
                type="life_insurance",
                currency="EUR",
                balance=25402.00,
                account_number="00012345682",
            ),
            AccountItem(
                external_id="MOCK-LOAN-006",
                name="Crédit Immobilier Résidence Principale",
                type="loan",
                currency="EUR",
                balance=-182450.20,
                account_number="00012345683",
            ),
        ]

    # Return cached accounts if available from poll_auth
    if sess.get("cached_accounts"):
        logger.info("Returning %d cached accounts for session %s", len(sess["cached_accounts"]), req.session_id)
        return sess["cached_accounts"]

    backend = sess.get("backend")
    if not backend:
        raise HTTPException(status_code=400, detail="Backend de session non disponible")

    results = []
    try:
        raw_accounts = []
        if sess.get("first_account"):
            raw_accounts.append(sess.pop("first_account"))
        for acc in backend.iter_accounts():
            if raw_accounts and acc.id == raw_accounts[0].id:
                continue
            raw_accounts.append(acc)

        for acc in raw_accounts:
            results.append(map_woob_account(acc))
    except Exception as e:
        logger.error("Failed to iterate accounts: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return results


FRENCH_PEA_INSTRUMENTS = {
    "AI": ("FR0000120073", "AI.PA"),
    "AIR": ("NL0000235190", "AIR.PA"),
    "CS": ("FR0000120628", "CS.PA"),
    "MC": ("FR0000121014", "MC.PA"),
    "TTE": ("FR0000120271", "TTE.PA"),
    "DG": ("FR0000125486", "DG.PA"),
    "NOV": ("DK0062498333", "NOVO-B.CO"),
    "SAN": ("FR0000120578", "SAN.PA"),
    "BNP": ("FR0000131104", "BNP.PA"),
    "OR": ("FR0000120321", "OR.PA"),
    "SU": ("FR0000121972", "SU.PA"),
    "CAP": ("FR0000125338", "CAP.PA"),
    "DSY": ("FR0014003TT8", "DSY.PA"),
    "RMS": ("FR0000052292", "RMS.PA"),
    "KER": ("FR0000121485", "KER.PA"),
    "SAF": ("FR0000073272", "SAF.PA"),
    "GLE": ("FR0000130809", "GLE.PA"),
    "ACA": ("FR0000045072", "ACA.PA"),
    "ENGI": ("FR0010208352", "ENGI.PA"),
    "RI": ("FR0000120693", "RI.PA"),
    "VIE": ("FR0000124141", "VIE.PA"),
    "STLAP": ("NL00150001Q9", "STLAP.PA"),
    "STM": ("NL0000226223", "STMPA.PA"),
    "HO": ("FR0000121329", "HO.PA"),
    "SGO": ("FR0000125007", "SGO.PA"),
    "EL": ("FR001400J770", "EL.PA"),
    "LR": ("FR0000053225", "LR.PA"),
    "TEP": ("FR0000051807", "TEP.PA"),
    "BN": ("FR0000120644", "BN.PA"),
    "EN": ("FR0000120503", "EN.PA"),
    "ML": ("FR001400AJ45", "ML.PA"),
    "CA": ("FR0000120172", "CA.PA"),
    "PUB": ("FR0000130577", "PUB.PA"),
    "VIV": ("FR0000127771", "VIV.PA"),
    "WLN": ("FR0011981968", "WLN.PA"),
}

ISIN_REGEX = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")
TICKER_IN_PARENS = re.compile(r"\(([A-Za-z0-9\.\-]+)\)\s*$")


@app.post("/api/v1/investments", response_model=List[InvestmentItem])
def list_investments(req: InvestmentsRequest):
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session expirée ou introuvable")

    if sess.get("mock"):
        acc_id = req.external_account_id.upper()
        if "AV" in acc_id or "VIE" in acc_id or "LIFE" in acc_id:
            return [
                InvestmentItem(
                    isin="FR-EUROS-001",
                    code="FONDS-EUROS",
                    symbol="FONDS-EUROS",
                    name="Fonds en Euros Général Garanti",
                    quantity=15000.0,
                    unit_value=1.00,
                    valuation=15000.00,
                    diff=450.00,
                ),
                InvestmentItem(
                    isin="FR0010756098",
                    code="CW8",
                    symbol="CW8.PA",
                    name="Amundi MSCI World UCITS ETF (CW8)",
                    quantity=10.0,
                    unit_value=540.20,
                    valuation=5402.00,
                    diff=520.00,
                ),
                InvestmentItem(
                    isin="FR0002601777",
                    code="COMGEST",
                    symbol="COMGEST.C",
                    name="Comgest Monde C (Unité de Compte)",
                    quantity=4.0,
                    unit_value=1250.00,
                    valuation=5000.00,
                    diff=320.00,
                ),
            ]

        return [
            InvestmentItem(
                isin="FR0010756098",
                code="CW8",
                symbol="CW8.PA",
                name="AMUNDI MSCI WORLD UCITS ETF - EUR (CW8)",
                quantity=25.0,
                unit_value=540.20,
                valuation=13505.00,
                diff=1250.00,
            ),
            InvestmentItem(
                isin="FR0011869353",
                code="ESE",
                symbol="ESE.PA",
                name="BNP PARIBAS EASY S&P 500 UCITS ETF (ESE)",
                quantity=40.0,
                unit_value=47.88,
                valuation=1915.20,
                diff=180.50,
            ),
            InvestmentItem(
                isin="FR0000120073",
                code="AI",
                symbol="AI.PA",
                name="AIR LIQUIDE (AI)",
                quantity=15.0,
                unit_value=178.50,
                valuation=2677.50,
                diff=240.00,
            ),
        ]

    backend = sess.get("backend")
    if not backend:
        raise HTTPException(status_code=400, detail="Backend de session non disponible")

    items = []
    try:
        # Find account
        target_account = None
        for acc in backend.iter_accounts():
            if str(acc.id) == req.external_account_id:
                target_account = acc
                break

        if not target_account:
            raise HTTPException(status_code=404, detail="Compte titres non trouvé")

        for inv in backend.iter_investment(target_account):
            inv_id = safe_str(getattr(inv, "id", None))
            inv_code = safe_str(getattr(inv, "code", None))
            inv_isin = safe_str(getattr(inv, "isin", None))
            name_val = safe_str(getattr(inv, "label", None), default="Investissement")
            qty_val = safe_float(getattr(inv, "quantity", 0.0), default=0.0)
            unit_val = safe_float(getattr(inv, "unitvalue", 0.0), default=0.0)
            val_val = safe_float(getattr(inv, "valuation", 0.0), default=0.0)
            diff_val = safe_float(getattr(inv, "diff", 0.0), default=0.0)

            # Skip synthetic cash lines from bank modules (e.g., Fortuneo's XX-liquidity)
            if inv_code == "XX-liquidity" or inv_isin == "XX-liquidity" or name_val.lower() == "liquidités" or inv_id == "XX-liquidity":
                continue

            # Skip empty holdings
            if qty_val <= 0:
                continue

            # Determine ISIN and Symbol
            resolved_isin = ""
            resolved_symbol = ""

            for cand in [inv_isin, inv_code, inv_id]:
                if cand and ISIN_REGEX.match(cand):
                    resolved_isin = cand
                    break

            # Extract ticker from label parentheses, e.g. "AIR LIQUIDE (AI)" -> "AI"
            m = TICKER_IN_PARENS.search(name_val)
            extracted_ticker = m.group(1).upper() if m else ""

            if not resolved_isin and extracted_ticker in FRENCH_PEA_INSTRUMENTS:
                resolved_isin, mapped_sym = FRENCH_PEA_INSTRUMENTS[extracted_ticker]
                resolved_symbol = mapped_sym
            elif extracted_ticker:
                resolved_symbol = extracted_ticker

            if not resolved_symbol:
                if resolved_isin:
                    resolved_symbol = resolved_isin
                elif inv_code:
                    resolved_symbol = inv_code
                elif inv_id:
                    resolved_symbol = inv_id
                elif extracted_ticker:
                    resolved_symbol = extracted_ticker
                else:
                    resolved_symbol = name_val[:10].strip().upper()

            logger.info("Parsed holding: name=%r isin=%r symbol=%r qty=%r price=%r val=%r",
                        name_val, resolved_isin, resolved_symbol, qty_val, unit_val, val_val)

            items.append(
                InvestmentItem(
                    isin=resolved_isin or resolved_symbol,
                    code=inv_code or resolved_symbol,
                    symbol=resolved_symbol,
                    name=name_val,
                    quantity=qty_val,
                    unit_value=unit_val,
                    valuation=val_val,
                    diff=diff_val,
                )
            )
    except Exception as e:
        logger.error("Failed to iterate investments: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return items


@app.post("/api/v1/loans", response_model=LoanDetails)
def get_loan_details(req: LoanRequest):
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session expirée ou introuvable")

    if sess.get("mock"):
        return LoanDetails(
            total_amount=200000.0,
            remaining_balance=182450.20,
            interest_rate=2.5,
            monthly_payment=1059.81,
            next_payment_date="2026-12-04",
            maturity_date="2044-01-04",
        )

    backend = sess.get("backend")
    if not backend:
        raise HTTPException(status_code=400, detail="Backend de session non disponible")

    try:
        target_account = None
        for acc in backend.iter_accounts():
            if str(acc.id) == req.external_account_id:
                target_account = acc
                break

        if not target_account:
            raise HTTPException(status_code=404, detail="Compte prêt non trouvé")

        total = safe_float(getattr(target_account, "total_amount", 0.0), default=0.0)
        bal = abs(safe_float(getattr(target_account, "balance", 0.0), default=0.0))
        rate = safe_float(getattr(target_account, "rate", 0.0), default=0.0)
        payment = safe_float(getattr(target_account, "next_payment_amount", 0.0), default=0.0)
        next_dt = getattr(target_account, "next_payment_date", None)
        next_dt_str = str(next_dt) if not empty(next_dt) and next_dt else None
        maturity_dt = getattr(target_account, "maturity_date", None)
        maturity_dt_str = str(maturity_dt) if not empty(maturity_dt) and maturity_dt else None

        return LoanDetails(
            total_amount=total if total > 0 else bal,
            remaining_balance=bal,
            interest_rate=rate,
            monthly_payment=payment,
            next_payment_date=next_dt_str,
            maturity_date=maturity_dt_str,
        )
    except Exception as e:
        logger.error("Failed to load loan details: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/transactions", response_model=List[TransactionItem])
def list_transactions(req: TransactionsRequest):
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session expirée ou introuvable")

    if sess.get("mock"):
        return [
            TransactionItem(
                external_id="TX-WOOB-001",
                name="Prélèvement Mensuel Crédit Immo",
                amount=-1059.81,
                currency="EUR",
                date="2026-11-04",
                raw="PRLV CRD IMMO CAISSE EPARGNE",
            ),
            TransactionItem(
                external_id="TX-WOOB-002",
                name="Achat ETF CW8 Fortuneo",
                amount=-540.20,
                currency="EUR",
                date="2026-11-02",
                raw="ACHAT CW8 1X540.20",
            ),
        ]

    backend = sess.get("backend")
    if not backend:
        raise HTTPException(status_code=400, detail="Backend de session non disponible")

    results = []
    try:
        target_account = None
        for acc in backend.iter_accounts():
            if str(acc.id) == req.external_account_id:
                target_account = acc
                break

        if not target_account:
            raise HTTPException(status_code=404, detail="Compte introuvable")

        for tx in backend.iter_history(target_account):
            tx_id = safe_str(getattr(tx, "id", None), default=str(uuid.uuid4()))
            tx_name = safe_str(getattr(tx, "label", None), default="Transaction")
            tx_amount = safe_float(getattr(tx, "amount", 0.0), default=0.0)
            tx_curr = safe_str(getattr(tx, "currency", None)) or safe_str(getattr(target_account, "currency", None), default="EUR")
            tx_date = getattr(tx, "date", None)
            if not empty(tx_date) and hasattr(tx_date, "strftime"):
                date_str = tx_date.strftime("%Y-%m-%d")
            else:
                date_str = time.strftime("%Y-%m-%d")
            tx_raw = safe_str(getattr(tx, "raw", None), default="")

            results.append(
                TransactionItem(
                    external_id=tx_id,
                    name=tx_name,
                    amount=tx_amount,
                    currency=tx_curr,
                    date=date_str,
                    raw=tx_raw,
                )
            )
    except Exception as e:
        logger.error("Failed to iterate transactions: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return results

