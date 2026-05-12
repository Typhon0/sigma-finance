package builder

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	sfpackwriter "sigma_finance/internal/marketdata/packs/writer/sfpack"

	"github.com/klauspost/compress/zstd"
)

type ValidateOptions struct {
	ArchiveSHA256      string
	SignaturePublicKey string
	SignaturePath      string
}

func ValidatePack(path string, opts ValidateOptions) (*UnpackedValidationSummary, error) {
	cleaned := filepath.Clean(strings.TrimSpace(path))
	if strings.EqualFold(filepath.Ext(cleaned), ".sfpack") {
		return validateArchive(cleaned, opts)
	}
	return ValidateUnpackedPack(cleaned)
}

func validateArchive(path string, opts ValidateOptions) (*UnpackedValidationSummary, error) {
	meta, err := sfpackwriter.InspectArchive(path)
	if err != nil {
		return nil, err
	}
	if expected := normalizeSHA256(strings.TrimSpace(opts.ArchiveSHA256)); expected != "" {
		if expected != normalizeSHA256(meta.ArchiveSHA256) {
			return nil, fmt.Errorf("archive sha256 mismatch")
		}
	}

	extractDir, err := os.MkdirTemp("", "sigma-finance-pack-validate-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(extractDir) //nolint:errcheck

	if err := extractTarZstd(path, extractDir); err != nil {
		return nil, err
	}
	if strings.TrimSpace(opts.SignaturePublicKey) != "" {
		signaturePath := strings.TrimSpace(opts.SignaturePath)
		if signaturePath == "" {
			signaturePath = path + ".sig"
		}
		if _, err := os.Stat(signaturePath); err != nil {
			return nil, fmt.Errorf("signature file is required for verification: %w", err)
		}
		if err := sfpackwriter.VerifySignature(opts.SignaturePublicKey, signaturePath, meta.ArchiveSHA256, meta.ManifestSHA256, meta.ChecksumsSHA256); err != nil {
			return nil, err
		}
	}
	return ValidateUnpackedPack(extractDir)
}

func extractTarZstd(archivePath, targetDir string) error {
	file, err := os.Open(filepath.Clean(archivePath))
	if err != nil {
		return err
	}
	defer file.Close()
	decoder, err := zstd.NewReader(file)
	if err != nil {
		return err
	}
	defer decoder.Close()
	reader := tar.NewReader(decoder)
	for {
		header, err := reader.Next()
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
			if _, err := io.Copy(out, reader); err != nil {
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

func normalizeSHA256(input string) string {
	cleaned := strings.TrimSpace(input)
	if strings.HasPrefix(strings.ToLower(cleaned), "sha256:") {
		cleaned = cleaned[len("sha256:"):]
	}
	return strings.ToLower(strings.TrimSpace(cleaned))
}
