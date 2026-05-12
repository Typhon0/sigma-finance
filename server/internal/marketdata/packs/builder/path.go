package builder

import (
	"fmt"
	"os"
	"path/filepath"
)

func resolveExistingPath(target string, specPath string) (string, error) {
	if filepath.IsAbs(target) {
		if exists(target) {
			return filepath.Clean(target), nil
		}
		return "", fmt.Errorf("path not found: %s", target)
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	candidates := make([]string, 0, 16)
	candidates = append(candidates, expandAncestorCandidates(cwd, target)...)
	if specPath != "" {
		candidates = append(candidates, expandAncestorCandidates(filepath.Dir(specPath), target)...)
	}
	for _, candidate := range candidates {
		cleaned := filepath.Clean(candidate)
		if exists(cleaned) {
			return cleaned, nil
		}
	}
	return "", fmt.Errorf("path not found: %s", target)
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func expandAncestorCandidates(base string, target string) []string {
	out := make([]string, 0, 8)
	current := filepath.Clean(base)
	for {
		out = append(out, filepath.Join(current, target))
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}
	return out
}
