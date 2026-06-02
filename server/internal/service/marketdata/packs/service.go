package packs

import (
	"archive/tar"
	"bufio"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/util"

	"github.com/google/uuid"
	"github.com/klauspost/compress/zstd"
	"github.com/shopspring/decimal"
)

const CurrentFormatVersion = 1

type Config struct {
	RegistryURL                   string
	StoragePath                   string
	SignaturePublicKey            string
	AppVersion                    string
	BuildJobStaleAfter            time.Duration
	LocalBuildDefaultHistoryYears int
	MarketParquetAPIBaseURL       string
	MarketParquetImportRoot       string
}

type Service interface {
	ListAvailablePacks(ctx context.Context) ([]RegistryPack, error)
	ListInstalledPacks(ctx context.Context) ([]model.MarketDataPack, error)
	InstallPack(ctx context.Context, packID string) (*model.MarketDataPackJob, error)
	InstallPackBlocking(ctx context.Context, packID string) (*model.MarketDataPackJob, error)
	UpdatePack(ctx context.Context, packID string) (*model.MarketDataPackJob, error)
	RemovePack(ctx context.Context, packID string) (*model.MarketDataPackJob, error)
	RepairPack(ctx context.Context, packID string) (*model.MarketDataPackJob, error)
	CancelPackJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error)
	GetPackJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error)
	GetCoverage(ctx context.Context, instrumentID string) ([]model.MarketDataPackCoverage, error)
	StartLocalPackBuild(ctx context.Context, userID string, input StartLocalPackBuildInput) (*model.MarketDataPackBuildJob, error)
	EstimateLocalPackBuild(ctx context.Context, userID string, input StartLocalPackBuildInput) (*LocalPackBuildEstimate, error)
	GetLocalPackBuildJob(ctx context.Context, userID string, jobID string) (*model.MarketDataPackBuildJob, error)
	GetLocalPackBuildJobItems(ctx context.Context, userID string, jobID string) ([]model.MarketDataPackBuildJobItem, error)
	ListLocalPackBuildJobs(ctx context.Context, userID string, limit int) ([]model.MarketDataPackBuildJob, error)
	CancelLocalPackBuild(ctx context.Context, userID string, jobID string) (*model.MarketDataPackBuildJob, error)
	RetryFailedLocalPackBuild(ctx context.Context, userID string, jobID string) (*model.MarketDataPackBuildJob, error)
	ResumeQueuedLocalPackBuilds(ctx context.Context) error
	RepairLocalBuildStorage(ctx context.Context) (int, error)
}

type Registry struct {
	LatestVersion string         `json:"latest_version"`
	Packs         []RegistryPack `json:"packs"`
}

type RegistryPack struct {
	PackID                string    `json:"pack_id"`
	Version               string    `json:"version"`
	Name                  string    `json:"name"`
	Description           string    `json:"description"`
	SizeBytes             int64     `json:"size_bytes"`
	CompressedSizeBytes   int64     `json:"compressed_size_bytes"`
	AssetsCount           int64     `json:"assets_count"`
	RowsCount             int64     `json:"rows_count"`
	Interval              string    `json:"interval"`
	AssetTypes            []string  `json:"asset_types"`
	QuoteCurrencies       []string  `json:"quote_currencies"`
	SourceProvider        string    `json:"source_provider,omitempty"`
	DataLicense           string    `json:"data_license,omitempty"`
	LicenseURL            string    `json:"license_url,omitempty"`
	RedistributionAllowed bool      `json:"redistribution_allowed,omitempty"`
	CommercialUseAllowed  bool      `json:"commercial_use_allowed,omitempty"`
	AttributionRequired   bool      `json:"attribution_required,omitempty"`
	GeneratedAt           time.Time `json:"generated_at,omitempty"`
	HistoryStart          string    `json:"history_start,omitempty"`
	HistoryEnd            string    `json:"history_end,omitempty"`
	InstallMode           string    `json:"install_mode,omitempty"`
	DownloadURL           string    `json:"download_url"`
	Checksum              string    `json:"checksum"`
	ArchiveSHA256         string    `json:"archive_sha256,omitempty"`
	SignatureURL          string    `json:"signature_url"`
	CreatedAt             time.Time `json:"created_at"`
	Recommended           bool      `json:"recommended"`
}

type Manifest struct {
	PackID                 string             `json:"pack_id"`
	Version                string             `json:"version"`
	Name                   string             `json:"name"`
	Description            string             `json:"description"`
	FormatVersion          int                `json:"format_version"`
	ParentPackID           *string            `json:"parent_pack_id,omitempty"`
	Distribution           string             `json:"distribution,omitempty"`
	Interval               string             `json:"interval"`
	AssetTypes             []string           `json:"asset_types,omitempty"`
	QuoteCurrencies        []string           `json:"quote_currencies,omitempty"`
	SourceProvider         string             `json:"source_provider"`
	DataLicense            string             `json:"data_license"`
	RedistributionAllowed  bool               `json:"redistribution_allowed"`
	CommercialUseAllowed   bool               `json:"commercial_use_allowed"`
	AttributionRequired    bool               `json:"attribution_required"`
	LicenseURL             string             `json:"license_url,omitempty"`
	GeneratedBy            string             `json:"generated_by,omitempty"`
	GeneratedByUser        bool               `json:"generated_by_user,omitempty"`
	UploadForbidden        bool               `json:"upload_forbidden,omitempty"`
	InstallMode            string             `json:"install_mode,omitempty"`
	GeneratedAt            time.Time          `json:"generated_at,omitempty"`
	HistoryStart           string             `json:"history_start,omitempty"`
	HistoryEnd             string             `json:"history_end,omitempty"`
	CreatedAt              time.Time          `json:"created_at,omitempty"`
	AssetsCount            int64              `json:"assets_count"`
	RowsCount              int64              `json:"rows_count"`
	Compression            string             `json:"compression,omitempty"`
	PriceAdjustment        string             `json:"price_adjustment,omitempty"`
	RawUnadjustedAvailable bool               `json:"raw_unadjusted_available,omitempty"`
	MinAppVersion          string             `json:"min_app_version,omitempty"`
	Files                  []ManifestFile     `json:"files"`
	Coverage               []ManifestCoverage `json:"coverage"`
}

type ManifestFile struct {
	Path     string `json:"path"`
	Rows     int64  `json:"rows"`
	Checksum string `json:"checksum"`
}

type ManifestCoverage struct {
	InstrumentID   string   `json:"instrument_id"`
	Symbol         string   `json:"symbol"`
	AssetType      string   `json:"asset_type"`
	Interval       string   `json:"interval,omitempty"`
	Exchange       string   `json:"exchange"`
	QuoteCurrency  string   `json:"quote_currency"`
	Source         string   `json:"source,omitempty"`
	DerivationType string   `json:"derivation_type,omitempty"`
	DerivedFrom    []string `json:"derived_from,omitempty"`
	FirstDate      string   `json:"first_date"`
	LastDate       string   `json:"last_date"`
	RowCount       int64    `json:"row_count"`
	FilePaths      []string `json:"file_paths"`
}

type packService struct {
	repo   repository.IMarketDataPackRepository
	cfg    Config
	client *http.Client
}

func NewService(repo repository.IMarketDataPackRepository, cfg Config) Service {
	if strings.TrimSpace(cfg.RegistryURL) == "" {
		cfg.RegistryURL = "https://github.com/Typhon0/sigma-finance/releases/latest/download/registry.json"
	}
	if strings.TrimSpace(cfg.StoragePath) == "" {
		cfg.StoragePath = "data/market-data/packs"
	}
	if strings.TrimSpace(cfg.AppVersion) == "" {
		cfg.AppVersion = "0.0.0"
	}
	if cfg.BuildJobStaleAfter <= 0 {
		cfg.BuildJobStaleAfter = 30 * time.Minute
	}
	if cfg.LocalBuildDefaultHistoryYears < 1 {
		cfg.LocalBuildDefaultHistoryYears = 10
	}
	if cfg.LocalBuildDefaultHistoryYears > 30 {
		cfg.LocalBuildDefaultHistoryYears = 30
	}
	if strings.TrimSpace(cfg.MarketParquetAPIBaseURL) == "" {
		cfg.MarketParquetAPIBaseURL = "https://www.marketparquet.com"
	}
	return &packService{
		repo: repo,
		cfg:  cfg,
		client: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}
}

func (s *packService) ListAvailablePacks(ctx context.Context) ([]RegistryPack, error) {
	registry, err := s.fetchRegistry(ctx)
	if err != nil {
		return nil, err
	}
	packs := registry.Packs
	sortRecommended(packs)
	return packs, nil
}

func (s *packService) ListInstalledPacks(ctx context.Context) ([]model.MarketDataPack, error) {
	return s.repo.ListInstalled(ctx)
}

func (s *packService) InstallPack(ctx context.Context, packID string) (*model.MarketDataPackJob, error) {
	job, err := s.createJob(ctx, packID, "install")
	if err != nil {
		return nil, err
	}
	util.RunTask(context.Background(), "installPack", func(ctx context.Context) {
		if err := s.runInstall(ctx, job.ID, packID); err != nil {
			// runInstall persists failure state.
			return
		}
	})
	return job, nil
}

func (s *packService) InstallPackBlocking(ctx context.Context, packID string) (*model.MarketDataPackJob, error) {
	job, err := s.createJob(ctx, packID, "install")
	if err != nil {
		return nil, err
	}
	err = s.runInstall(ctx, job.ID, packID)
	latest, latestErr := s.repo.GetJob(ctx, job.ID)
	if latestErr != nil {
		return job, err
	}
	if err != nil {
		return latest, err
	}
	return latest, nil
}

func (s *packService) UpdatePack(ctx context.Context, packID string) (*model.MarketDataPackJob, error) {
	return s.InstallPack(ctx, packID)
}

func (s *packService) RemovePack(ctx context.Context, packID string) (*model.MarketDataPackJob, error) {
	job, err := s.createJob(ctx, packID, "remove")
	if err != nil {
		return nil, err
	}
	err = s.runRemove(ctx, job.ID, packID)
	latest, latestErr := s.repo.GetJob(ctx, job.ID)
	if latestErr != nil {
		return job, err
	}
	return latest, err
}

func (s *packService) RepairPack(ctx context.Context, packID string) (*model.MarketDataPackJob, error) {
	job, err := s.createJob(ctx, packID, "repair")
	if err != nil {
		return nil, err
	}
	err = s.runRepair(ctx, job.ID, packID)
	latest, latestErr := s.repo.GetJob(ctx, job.ID)
	if latestErr != nil {
		return job, err
	}
	return latest, err
}

func (s *packService) CancelPackJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if job.Status == "queued" {
		now := time.Now()
		job.Status = "canceled"
		job.FinishedAt = &now
		if err := s.repo.UpdateJob(ctx, job); err != nil {
			return nil, err
		}
	}
	return job, nil
}

func (s *packService) GetPackJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error) {
	return s.repo.GetJob(ctx, jobID)
}

func (s *packService) GetCoverage(ctx context.Context, instrumentID string) ([]model.MarketDataPackCoverage, error) {
	return s.repo.ListCoverage(ctx, instrumentID)
}

func (s *packService) createJob(ctx context.Context, packID, jobType string) (*model.MarketDataPackJob, error) {
	job := &model.MarketDataPackJob{
		ID:              uuid.NewString(),
		PackID:          packID,
		JobType:         jobType,
		Status:          "queued",
		ProgressPercent: decimal.Zero,
		CreatedAt:       time.Now(),
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *packService) runInstall(ctx context.Context, jobID, packID string) error {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return err
	}
	now := time.Now()
	job.Status = "running"
	job.StartedAt = &now
	job.ProgressPercent = decimal.NewFromInt(5)
	if err := s.repo.UpdateJob(ctx, job); err != nil {
		return err
	}

	registry, err := s.fetchRegistry(ctx)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	entry, ok := findRegistryPack(registry.Packs, packID)
	if !ok {
		return s.failJob(ctx, job, fmt.Errorf("pack %s not found in registry", packID))
	}

	if err := os.MkdirAll(s.cfg.StoragePath, 0o755); err != nil {
		return s.failJob(ctx, job, err)
	}
	tempDir, err := os.MkdirTemp(s.cfg.StoragePath, "."+packID+"-tmp-*")
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	defer os.RemoveAll(tempDir)

	archivePath := filepath.Join(tempDir, packID+".sfpack")
	downloaded, err := s.download(ctx, entry.DownloadURL, archivePath)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	job.DownloadedBytes = downloaded
	job.TotalBytes = entry.CompressedSizeBytes
	job.ProgressPercent = decimal.NewFromInt(35)
	_ = s.repo.UpdateJob(ctx, job)

	if err := verifyFileChecksum(archivePath, registryArchiveDigest(entry)); err != nil {
		return s.failJob(ctx, job, err)
	}
	requireSignature := strings.TrimSpace(s.cfg.SignaturePublicKey) != ""
	if requireSignature && strings.TrimSpace(entry.SignatureURL) == "" {
		return s.failJob(ctx, job, fmt.Errorf("signature URL is required when MARKET_DATA_PACK_SIGNATURE_PUBLIC_KEY is configured"))
	}
	job.ProgressPercent = decimal.NewFromInt(55)
	_ = s.repo.UpdateJob(ctx, job)

	extractDir := filepath.Join(tempDir, "extract")
	if err := os.MkdirAll(extractDir, 0o755); err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := extractTarZstd(archivePath, extractDir); err != nil {
		return s.failJob(ctx, job, err)
	}
	manifest, err := LoadManifest(extractDir)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := ValidateManifest(manifest, s.cfg.AppVersion); err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := ValidatePackChecksums(extractDir, manifest); err != nil {
		return s.failJob(ctx, job, err)
	}
	signatureVerified := false
	if requireSignature {
		if err := s.verifySignature(ctx, entry, manifest, extractDir); err != nil {
			return s.failJob(ctx, job, err)
		}
		signatureVerified = true
	}

	finalDir := filepath.Join(s.cfg.StoragePath, safePackDir(manifest.PackID, manifest.Version))
	_ = os.RemoveAll(finalDir)
	if err := os.Rename(extractDir, finalDir); err != nil {
		return s.failJob(ctx, job, err)
	}

	installedAt := time.Now()
	desc := manifest.Description
	pack := &model.MarketDataPack{
		ID:                manifest.PackID,
		Version:           manifest.Version,
		Name:              manifest.Name,
		Description:       &desc,
		FormatVersion:     manifest.FormatVersion,
		Status:            "installed",
		ParentPackID:      manifest.ParentPackID,
		PackPriority:      int(installedAt.Unix()),
		FilePath:          finalDir,
		Checksum:          normalizeSHA256(registryArchiveDigest(entry)),
		SignatureVerified: signatureVerified,
		AssetsCount:       manifest.AssetsCount,
		RowsCount:         manifest.RowsCount,
		InstalledAt:       &installedAt,
		UpdatedAt:         &installedAt,
	}
	if err := s.repo.UpsertPack(ctx, pack); err != nil {
		return s.failJob(ctx, job, err)
	}
	coverage, err := manifestCoverageToModels(manifest)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := s.repo.ReplaceCoverage(ctx, manifest.PackID, coverage); err != nil {
		return s.failJob(ctx, job, err)
	}

	job.Status = "succeeded"
	job.ProgressPercent = decimal.NewFromInt(100)
	job.ImportedRows = 0
	job.FinishedAt = &installedAt
	if err := s.repo.UpdateJob(ctx, job); err != nil {
		return err
	}
	return nil
}

func (s *packService) runRemove(ctx context.Context, jobID, packID string) error {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return err
	}
	now := time.Now()
	job.Status = "running"
	job.StartedAt = &now
	_ = s.repo.UpdateJob(ctx, job)

	pack, err := s.repo.Get(ctx, packID)
	if err == nil && pack.FilePath != "" {
		if removeErr := os.RemoveAll(pack.FilePath); removeErr != nil {
			return s.failJob(ctx, job, removeErr)
		}
	}
	if err := s.repo.DeletePack(ctx, packID); err != nil {
		return s.failJob(ctx, job, err)
	}
	finished := time.Now()
	job.Status = "succeeded"
	job.ProgressPercent = decimal.NewFromInt(100)
	job.FinishedAt = &finished
	return s.repo.UpdateJob(ctx, job)
}

func (s *packService) runRepair(ctx context.Context, jobID, packID string) error {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return err
	}
	now := time.Now()
	job.Status = "running"
	job.StartedAt = &now
	_ = s.repo.UpdateJob(ctx, job)

	pack, err := s.repo.Get(ctx, packID)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	manifest, err := LoadManifest(pack.FilePath)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := ValidateManifest(manifest, s.cfg.AppVersion); err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := ValidatePackChecksums(pack.FilePath, manifest); err != nil {
		return s.failJob(ctx, job, err)
	}
	coverage, err := manifestCoverageToModels(manifest)
	if err != nil {
		return s.failJob(ctx, job, err)
	}
	if err := s.repo.ReplaceCoverage(ctx, packID, coverage); err != nil {
		return s.failJob(ctx, job, err)
	}
	finished := time.Now()
	job.Status = "succeeded"
	job.ProgressPercent = decimal.NewFromInt(100)
	job.FinishedAt = &finished
	return s.repo.UpdateJob(ctx, job)
}

func (s *packService) failJob(ctx context.Context, job *model.MarketDataPackJob, err error) error {
	message := err.Error()
	now := time.Now()
	job.Status = "failed"
	job.ErrorMessage = &message
	job.FinishedAt = &now
	_ = s.repo.UpdateJob(ctx, job)
	return err
}

func (s *packService) fetchRegistry(ctx context.Context) (*Registry, error) {
	var reader io.ReadCloser
	registryURL := strings.TrimSpace(s.cfg.RegistryURL)
	if strings.HasPrefix(registryURL, "file://") {
		file, err := os.Open(strings.TrimPrefix(registryURL, "file://"))
		if err != nil {
			return nil, err
		}
		reader = file
	} else if strings.HasPrefix(registryURL, "/") || strings.HasPrefix(registryURL, ".") {
		file, err := os.Open(registryURL)
		if err != nil {
			return nil, err
		}
		reader = file
	} else {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, registryURL, nil)
		if err != nil {
			return nil, err
		}
		resp, err := s.client.Do(req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			return nil, fmt.Errorf("registry returned HTTP %d", resp.StatusCode)
		}
		reader = resp.Body
	}
	defer reader.Close()

	var registry Registry
	if err := json.NewDecoder(reader).Decode(&registry); err != nil {
		return nil, err
	}
	return &registry, nil
}

func (s *packService) download(ctx context.Context, sourceURL, targetPath string) (int64, error) {
	if strings.HasPrefix(sourceURL, "file://") || strings.HasPrefix(sourceURL, "/") || strings.HasPrefix(sourceURL, ".") {
		sourcePath := strings.TrimPrefix(sourceURL, "file://")
		src, err := os.Open(sourcePath)
		if err != nil {
			return 0, err
		}
		defer src.Close()
		dst, err := os.Create(targetPath)
		if err != nil {
			return 0, err
		}
		defer dst.Close()
		return io.Copy(dst, src)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return 0, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("download returned HTTP %d", resp.StatusCode)
	}
	dst, err := os.Create(targetPath)
	if err != nil {
		return 0, err
	}
	defer dst.Close()
	return io.Copy(dst, resp.Body)
}

func (s *packService) verifySignature(ctx context.Context, entry RegistryPack, manifest *Manifest, root string) error {
	manifestDigest, err := sha256FileHex(filepath.Join(root, "manifest.json"))
	if err != nil {
		return err
	}
	checksumsPath := filepath.Join(root, "checksums.sha256")
	checksumsDigest, err := sha256FileHex(checksumsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("checksums.sha256 is required when signature verification is enabled")
		}
		return err
	}
	payload := BuildSignaturePayload(normalizeSHA256(registryArchiveDigest(entry)), manifestDigest, checksumsDigest)

	sigFile, err := os.CreateTemp("", "sfpack-signature-*")
	if err != nil {
		return err
	}
	defer os.Remove(sigFile.Name())
	sigFile.Close()
	if _, err := s.download(ctx, entry.SignatureURL, sigFile.Name()); err != nil {
		return err
	}
	signature, err := os.ReadFile(sigFile.Name())
	if err != nil {
		return err
	}
	key, err := decodePublicKey(s.cfg.SignaturePublicKey)
	if err != nil {
		return err
	}
	signatureToVerify := signature
	if len(signatureToVerify) != ed25519.SignatureSize {
		signatureToVerify = bytesTrimSpace(signature)
	}
	if !ed25519.Verify(key, payload, signatureToVerify) {
		return fmt.Errorf("pack signature verification failed")
	}
	return nil
}

type SignaturePayload struct {
	ArchiveSHA256   string `json:"archive_sha256"`
	ChecksumsSHA256 string `json:"checksums_sha256"`
	ManifestSHA256  string `json:"manifest_sha256"`
}

func BuildSignaturePayload(archiveDigest, manifestDigest, checksumsDigest string) []byte {
	payload := SignaturePayload{
		ArchiveSHA256:   strings.TrimSpace(archiveDigest),
		ChecksumsSHA256: strings.TrimSpace(checksumsDigest),
		ManifestSHA256:  strings.TrimSpace(manifestDigest),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		// SignaturePayload is static and always marshalable.
		panic(err)
	}
	return encoded
}

func sha256FileHex(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func normalizeSHA256(input string) string {
	cleaned := strings.TrimSpace(input)
	if strings.HasPrefix(strings.ToLower(cleaned), "sha256:") {
		cleaned = cleaned[len("sha256:"):]
	}
	return strings.ToLower(strings.TrimSpace(cleaned))
}

func LoadManifest(root string) (*Manifest, error) {
	file, err := os.Open(filepath.Join(root, "manifest.json"))
	if err != nil {
		return nil, err
	}
	defer file.Close()
	var manifest Manifest
	if err := json.NewDecoder(file).Decode(&manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func ValidateManifest(manifest *Manifest, appVersion string) error {
	if manifest == nil {
		return fmt.Errorf("manifest is required")
	}
	if strings.TrimSpace(manifest.PackID) == "" {
		return fmt.Errorf("manifest pack_id is required")
	}
	if manifest.FormatVersion <= 0 || manifest.FormatVersion > CurrentFormatVersion {
		return fmt.Errorf("unsupported pack format version %d", manifest.FormatVersion)
	}
	if manifest.Interval != string(model.Interval1d) {
		return fmt.Errorf("only daily candle packs are supported")
	}
	if manifest.RowsCount < 0 || manifest.AssetsCount < 0 {
		return fmt.Errorf("manifest counts cannot be negative")
	}
	if len(manifest.Files) == 0 {
		return fmt.Errorf("manifest files are required")
	}
	if strings.TrimSpace(manifest.MinAppVersion) != "" && compareDottedVersion(appVersion, manifest.MinAppVersion) < 0 {
		return fmt.Errorf("pack requires app version %s or newer", manifest.MinAppVersion)
	}
	return nil
}

func ValidatePackChecksums(root string, manifest *Manifest) error {
	for _, file := range manifest.Files {
		if err := verifyFileChecksum(filepath.Join(root, filepath.Clean(file.Path)), file.Checksum); err != nil {
			return err
		}
	}
	checksumPath := filepath.Join(root, "checksums.sha256")
	if _, err := os.Stat(checksumPath); err == nil {
		return validateChecksumFile(root, checksumPath)
	}
	return nil
}

func verifyFileChecksum(path, expected string) error {
	expected = strings.TrimSpace(strings.TrimPrefix(expected, "sha256:"))
	if expected == "" {
		return fmt.Errorf("checksum is required for %s", path)
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, expected) {
		return fmt.Errorf("bad checksum for %s", path)
	}
	return nil
}

func validateChecksumFile(root, checksumPath string) error {
	file, err := os.Open(checksumPath)
	if err != nil {
		return err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			return fmt.Errorf("invalid checksum line: %s", line)
		}
		if err := verifyFileChecksum(filepath.Join(root, filepath.Clean(parts[1])), parts[0]); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func extractTarZstd(archivePath, targetDir string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()
	zr, err := zstd.NewReader(file)
	if err != nil {
		return err
	}
	defer zr.Close()
	tr := tar.NewReader(zr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		targetPath, err := safeJoin(targetDir, header.Name)
		if err != nil {
			return err
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			if err := out.Close(); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported tar entry %s", header.Name)
		}
	}
}

func manifestCoverageToModels(manifest *Manifest) ([]model.MarketDataPackCoverage, error) {
	out := make([]model.MarketDataPackCoverage, 0, len(manifest.Coverage))
	for _, cov := range manifest.Coverage {
		first, err := time.Parse(time.DateOnly, cov.FirstDate)
		if err != nil {
			return nil, err
		}
		last, err := time.Parse(time.DateOnly, cov.LastDate)
		if err != nil {
			return nil, err
		}
		paths, err := json.Marshal(cov.FilePaths)
		if err != nil {
			return nil, err
		}
		out = append(out, model.MarketDataPackCoverage{
			PackID:        manifest.PackID,
			InstrumentID:  cov.InstrumentID,
			Symbol:        cov.Symbol,
			AssetType:     cov.AssetType,
			Interval:      model.CandleInterval(firstNonEmpty(cov.Interval, manifest.Interval)),
			QuoteCurrency: cov.QuoteCurrency,
			FirstDate:     first,
			LastDate:      last,
			RowCount:      cov.RowCount,
			FilePaths:     paths,
		})
	}
	return out, nil
}

func decodePublicKey(input string) (ed25519.PublicKey, error) {
	cleaned := strings.TrimSpace(input)
	if block, _ := pem.Decode([]byte(cleaned)); block != nil {
		key, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		ed, ok := key.(ed25519.PublicKey)
		if !ok {
			return nil, fmt.Errorf("public key is not ed25519")
		}
		return ed, nil
	}
	if decoded, err := base64.StdEncoding.DecodeString(cleaned); err == nil && len(decoded) == ed25519.PublicKeySize {
		return ed25519.PublicKey(decoded), nil
	}
	if decoded, err := hex.DecodeString(cleaned); err == nil && len(decoded) == ed25519.PublicKeySize {
		return ed25519.PublicKey(decoded), nil
	}
	return nil, fmt.Errorf("invalid ed25519 public key")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func safeJoin(root, name string) (string, error) {
	target := filepath.Join(root, filepath.Clean(name))
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", fmt.Errorf("unsafe pack path %s", name)
	}
	return target, nil
}

func safePackDir(packID, version string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "..", "_")
	return replacer.Replace(packID + "-" + version)
}

func findRegistryPack(packs []RegistryPack, packID string) (RegistryPack, bool) {
	for _, pack := range packs {
		if pack.PackID == packID {
			return pack, true
		}
	}
	return RegistryPack{}, false
}

func sortRecommended(packs []RegistryPack) {
	for i := range packs {
		for j := i + 1; j < len(packs); j++ {
			if packs[j].Recommended && !packs[i].Recommended {
				packs[i], packs[j] = packs[j], packs[i]
			}
		}
	}
}

func compareDottedVersion(a, b string) int {
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	maxLen := len(as)
	if len(bs) > maxLen {
		maxLen = len(bs)
	}
	for i := 0; i < maxLen; i++ {
		ai, bi := 0, 0
		if i < len(as) {
			ai, _ = strconv.Atoi(strings.TrimLeftFunc(as[i], func(r rune) bool { return r < '0' || r > '9' }))
		}
		if i < len(bs) {
			bi, _ = strconv.Atoi(strings.TrimLeftFunc(bs[i], func(r rune) bool { return r < '0' || r > '9' }))
		}
		if ai > bi {
			return 1
		}
		if ai < bi {
			return -1
		}
	}
	return 0
}

func bytesTrimSpace(input []byte) []byte {
	return []byte(strings.TrimSpace(string(input)))
}

func registryArchiveDigest(entry RegistryPack) string {
	if strings.TrimSpace(entry.ArchiveSHA256) != "" {
		return entry.ArchiveSHA256
	}
	return entry.Checksum
}
