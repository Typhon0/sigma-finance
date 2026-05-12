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

func PrepareBuild(_ context.Context, specPath string, outDir string) (*BuildPlan, error) {
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

	plan.LicenseGate = licensegate.Evaluate(spec.Distribution, spec.LicensePolicy, policy)
	if !plan.LicenseGate.Allowed {
		return nil, fmt.Errorf("license gate blocked build: %s", strings.Join(plan.LicenseGate.Errors, "; "))
	}

	return plan, nil
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
