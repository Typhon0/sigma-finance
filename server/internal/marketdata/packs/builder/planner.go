package builder

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	licensegate "sigma_finance/internal/marketdata/packs/license"
	"sigma_finance/internal/marketdata/packs/sources"
)

type BuildPlan struct {
	Spec          *PackSpec
	SpecPath      string
	UniversePath  string
	LicensePath   string
	LicensePolicy *licensegate.Policy
	Universe      *sources.Universe
	LicenseGate   licensegate.GateResult
	OutputDir     string
}

const (
	BuildModePublicRelease = "public_release"
	BuildModeCIFixture     = "ci_fixture"
	BuildModeLocalUser     = "local_user_build"
)

func PrepareBuild(ctx context.Context, specPath string, outDir string) (*BuildPlan, error) {
	return PrepareBuildForMode(ctx, specPath, outDir, BuildModeLocalUser)
}

func PrepareBuildForMode(_ context.Context, specPath string, outDir string, buildMode string) (*BuildPlan, error) {
	if strings.TrimSpace(specPath) == "" {
		return nil, fmt.Errorf("spec path is required")
	}
	resolvedSpecPath, err := resolveExistingPath(specPath, "")
	if err != nil {
		return nil, err
	}
	spec, err := LoadSpec(resolvedSpecPath)
	if err != nil {
		return nil, err
	}

	universePath, err := resolveExistingPath(spec.Universe.File, resolvedSpecPath)
	if err != nil {
		return nil, fmt.Errorf("resolve universe file: %w", err)
	}
	universe, err := sources.LoadUniverse(universePath)
	if err != nil {
		return nil, err
	}

	plan := &BuildPlan{
		Spec:         spec,
		SpecPath:     resolvedSpecPath,
		UniversePath: universePath,
		Universe:     universe,
		OutputDir:    strings.TrimSpace(outDir),
	}
	if plan.OutputDir == "" {
		plan.OutputDir = "."
	}
	plan.OutputDir = filepath.Clean(plan.OutputDir)

	policy, policyPath, err := loadPolicy(spec.LicensePolicy, resolvedSpecPath)
	if err != nil {
		if strings.EqualFold(spec.Distribution, "public") {
			return nil, err
		}
	}
	plan.LicensePolicy = policy
	plan.LicensePath = policyPath
	if err := validateBuildMode(plan, buildMode); err != nil {
		return nil, err
	}

	plan.LicenseGate = licensegate.Evaluate(spec.Distribution, spec.LicensePolicy, policy)
	if !plan.LicenseGate.Allowed {
		return nil, fmt.Errorf("license gate blocked build: %s", strings.Join(plan.LicenseGate.Errors, "; "))
	}

	return plan, nil
}

func validateBuildMode(plan *BuildPlan, buildMode string) error {
	if plan == nil || plan.Spec == nil {
		return fmt.Errorf("build plan is required")
	}
	mode := strings.ToLower(strings.TrimSpace(buildMode))
	if mode == "" {
		mode = BuildModeLocalUser
	}
	if mode != BuildModePublicRelease && mode != BuildModeCIFixture && mode != BuildModeLocalUser {
		return fmt.Errorf("unsupported build mode %q", buildMode)
	}
	if mode == BuildModeLocalUser {
		return validateLocalUserBuildMode(plan)
	}
	if mode != BuildModePublicRelease {
		return nil
	}

	packID := strings.TrimSpace(plan.Spec.PackID)
	distribution := strings.ToLower(strings.TrimSpace(plan.Spec.Distribution))
	sourceProvider := strings.ToLower(strings.TrimSpace(plan.Spec.SourceProvider))
	if sourceProvider == "marketparquet" {
		return fmt.Errorf("public_release build rejected: MarketParquet packs are local-user-build only")
	}
	if distribution != "public" {
		return fmt.Errorf("public_release build rejected: pack %s has upload_forbidden=true", packID)
	}
	if plan.Spec.UploadForbidden {
		return fmt.Errorf("public_release build rejected: pack %s has upload_forbidden=true", packID)
	}
	if strings.EqualFold(strings.TrimSpace(plan.Spec.InstallMode), "build_local") {
		return fmt.Errorf("public_release build rejected: pack %s has upload_forbidden=true", packID)
	}
	if plan.Spec.GeneratedByUser {
		return fmt.Errorf("public_release build rejected: pack %s has upload_forbidden=true", packID)
	}

	assetType := strings.ToUpper(strings.TrimSpace(plan.Spec.AssetType))
	if assetType == "STOCK" || assetType == "FUND" || assetType == "ETF" {
		if plan.LicensePolicy == nil || !plan.LicensePolicy.RedistributionAllowed {
			return fmt.Errorf("public_release build rejected: STOCK/FUND packs require explicit redistribution license")
		}
	}

	if (plan.Spec.RedistributionAllowed != nil && !*plan.Spec.RedistributionAllowed) || (plan.LicensePolicy != nil && !plan.LicensePolicy.RedistributionAllowed) {
		return fmt.Errorf("public_release build rejected: pack %s has redistribution_allowed=false", packID)
	}

	return nil
}

func validateLocalUserBuildMode(plan *BuildPlan) error {
	packID := strings.TrimSpace(plan.Spec.PackID)
	distribution := strings.ToLower(strings.TrimSpace(plan.Spec.Distribution))
	if distribution == "public" {
		return fmt.Errorf("local_user_build rejected: pack %s has distribution=public", packID)
	}
	if plan.Spec.RedistributionAllowed != nil && *plan.Spec.RedistributionAllowed {
		return fmt.Errorf("local_user_build rejected: pack %s has redistribution_allowed=true", packID)
	}
	if plan.LicensePolicy != nil && plan.LicensePolicy.RedistributionAllowed {
		return fmt.Errorf("local_user_build rejected: pack %s has redistribution_allowed=true", packID)
	}
	if !plan.Spec.UploadForbidden {
		return fmt.Errorf("local_user_build rejected: pack %s has upload_forbidden=false", packID)
	}
	return nil
}

func loadPolicy(policyName string, specPath string) (*licensegate.Policy, string, error) {
	name := strings.TrimSpace(policyName)
	if name == "" {
		return nil, "", nil
	}
	policyRef := filepath.Join("packs", "licenses", name+".yaml")
	policyPath, err := resolveExistingPath(policyRef, specPath)
	if err != nil {
		return nil, "", fmt.Errorf("unknown license policy %q", name)
	}
	policy, err := licensegate.LoadPolicy(policyPath)
	if err != nil {
		return nil, "", err
	}
	return policy, policyPath, nil
}
