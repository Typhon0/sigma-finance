package license

import (
	"fmt"
	"strings"
)

type GateResult struct {
	Allowed  bool
	Errors   []string
	Warnings []string
}

func Evaluate(distribution string, policyName string, policy *Policy) GateResult {
	result := GateResult{}
	dist := strings.ToLower(strings.TrimSpace(distribution))
	name := strings.TrimSpace(policyName)

	switch dist {
	case "public":
		if name == "" {
			result.Errors = append(result.Errors, "missing license policy for public distribution")
			return finalize(result)
		}
		if policy == nil {
			result.Errors = append(result.Errors, fmt.Sprintf("unknown license policy %q", name))
			return finalize(result)
		}
		if !policy.RedistributionAllowed {
			result.Errors = append(result.Errors, "public distribution requires redistribution_allowed=true")
		}
		if !policy.CommercialUseAllowed {
			result.Errors = append(result.Errors, "public official pack requires commercial_use_allowed=true")
		}
		if !distributionModeAllowed(policy, "public") {
			result.Errors = append(result.Errors, "license policy does not allow public distribution mode")
		}
	case "private", "local":
		if name == "" {
			result.Warnings = append(result.Warnings, "license policy missing; continue because distribution is not public")
			return finalize(result)
		}
		if policy == nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("unknown license policy %q; continue because distribution is not public", name))
			return finalize(result)
		}
		if !policy.RedistributionAllowed {
			result.Warnings = append(result.Warnings, "redistribution_allowed=false; allowed for non-public build only")
		}
		if !policy.CommercialUseAllowed {
			result.Warnings = append(result.Warnings, "commercial_use_allowed=false; allowed for non-public build only")
		}
		if !distributionModeAllowed(policy, dist) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("license policy does not explicitly allow %s mode", dist))
		}
	default:
		result.Errors = append(result.Errors, fmt.Sprintf("unsupported distribution mode %q", distribution))
	}

	return finalize(result)
}

func distributionModeAllowed(policy *Policy, mode string) bool {
	if policy == nil {
		return false
	}
	if len(policy.AllowedDistributionModes) == 0 {
		return true
	}
	needle := strings.ToLower(strings.TrimSpace(mode))
	for _, value := range policy.AllowedDistributionModes {
		if strings.ToLower(strings.TrimSpace(value)) == needle {
			return true
		}
	}
	return false
}

func finalize(result GateResult) GateResult {
	result.Allowed = len(result.Errors) == 0
	return result
}
