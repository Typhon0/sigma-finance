package sfpack

import (
	"archive/tar"
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
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	packservice "sigma_finance/internal/service/marketdata/packs"

	"github.com/klauspost/compress/zstd"
)

const (
	generatedBy = "sigma-finance pack-builder"
)

type ArchiveOptions struct {
	PackDir               string
	OutDir                string
	SigningKey            string
	AllowUnsignedPublic   bool
	ArchiveFilenameSuffix string
}

type ArchiveResult struct {
	PackID          string
	Version         string
	PackPath        string
	SignaturePath   string
	ArchiveSHA256   string
	ManifestSHA256  string
	ChecksumsSHA256 string
	SizeBytes       int64
	Manifest        *packservice.Manifest
}

type ArchiveMetadata struct {
	PackID          string
	Version         string
	ArchivePath     string
	ArchiveSHA256   string
	ManifestSHA256  string
	ChecksumsSHA256 string
	SizeBytes       int64
	Manifest        *packservice.Manifest
}

func CreateArchive(ctx context.Context, opts ArchiveOptions) (*ArchiveResult, error) {
	packDir := filepath.Clean(strings.TrimSpace(opts.PackDir))
	if packDir == "" {
		return nil, fmt.Errorf("pack dir is required")
	}
	manifest, err := packservice.LoadManifest(packDir)
	if err != nil {
		return nil, err
	}
	if err := packservice.ValidateManifest(manifest, "0.0.0"); err != nil {
		return nil, err
	}
	if err := packservice.ValidatePackChecksums(packDir, manifest); err != nil {
		return nil, err
	}

	isPublic := strings.EqualFold(strings.TrimSpace(manifest.Distribution), "public")
	signingKey := strings.TrimSpace(opts.SigningKey)
	if isPublic && signingKey == "" && !opts.AllowUnsignedPublic {
		return nil, fmt.Errorf("public pack requires signature; pass --allow-unsigned-public to bypass")
	}

	outDir := strings.TrimSpace(opts.OutDir)
	if outDir == "" {
		outDir = packDir
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, err
	}

	baseName := fmt.Sprintf("%s-%s.sfpack", strings.TrimSpace(manifest.PackID), strings.TrimSpace(manifest.Version))
	if suffix := strings.TrimSpace(opts.ArchiveFilenameSuffix); suffix != "" {
		baseName = strings.TrimSuffix(baseName, ".sfpack") + suffix + ".sfpack"
	}
	packPath := filepath.Join(outDir, baseName)
	if err := writeTarZstd(ctx, packDir, packPath); err != nil {
		return nil, err
	}

	archiveDigest, err := sha256FileHex(packPath)
	if err != nil {
		return nil, err
	}
	manifestDigest, err := sha256FileHex(filepath.Join(packDir, "manifest.json"))
	if err != nil {
		return nil, err
	}
	checksumsDigest, err := sha256FileHex(filepath.Join(packDir, "checksums.sha256"))
	if err != nil {
		return nil, err
	}
	stat, err := os.Stat(packPath)
	if err != nil {
		return nil, err
	}

	result := &ArchiveResult{
		PackID:          strings.TrimSpace(manifest.PackID),
		Version:         strings.TrimSpace(manifest.Version),
		PackPath:        packPath,
		ArchiveSHA256:   archiveDigest,
		ManifestSHA256:  manifestDigest,
		ChecksumsSHA256: checksumsDigest,
		SizeBytes:       stat.Size(),
		Manifest:        manifest,
	}

	if signingKey != "" {
		sigPath := packPath + ".sig"
		if err := SignArchive(SignArchiveOptions{
			PackPath:       packPath,
			ManifestPath:   filepath.Join(packDir, "manifest.json"),
			ChecksumsPath:  filepath.Join(packDir, "checksums.sha256"),
			OutputPath:     sigPath,
			SigningKeySpec: signingKey,
		}); err != nil {
			return nil, err
		}
		result.SignaturePath = sigPath
	}

	return result, nil
}

type SignArchiveOptions struct {
	PackPath       string
	ManifestPath   string
	ChecksumsPath  string
	OutputPath     string
	SigningKeySpec string
}

func SignArchive(opts SignArchiveOptions) error {
	packDigest, err := sha256FileHex(filepath.Clean(strings.TrimSpace(opts.PackPath)))
	if err != nil {
		return err
	}
	manifestDigest, err := sha256FileHex(filepath.Clean(strings.TrimSpace(opts.ManifestPath)))
	if err != nil {
		return err
	}
	checksumsDigest, err := sha256FileHex(filepath.Clean(strings.TrimSpace(opts.ChecksumsPath)))
	if err != nil {
		return err
	}
	key, err := parsePrivateKey(opts.SigningKeySpec)
	if err != nil {
		return err
	}

	payload := packservice.BuildSignaturePayload(packDigest, manifestDigest, checksumsDigest)
	signature := ed25519.Sign(key, payload)
	return os.WriteFile(filepath.Clean(strings.TrimSpace(opts.OutputPath)), signature, 0o644)
}

func VerifySignature(publicKey, signaturePath, archiveDigest, manifestDigest, checksumsDigest string) error {
	key, err := parsePublicKey(publicKey)
	if err != nil {
		return err
	}
	signature, err := os.ReadFile(filepath.Clean(strings.TrimSpace(signaturePath)))
	if err != nil {
		return err
	}
	payload := packservice.BuildSignaturePayload(archiveDigest, manifestDigest, checksumsDigest)
	signatureToVerify := signature
	if len(signatureToVerify) != ed25519.SignatureSize {
		signatureToVerify = bytesTrimSpace(signature)
	}
	if !ed25519.Verify(key, payload, signatureToVerify) {
		return fmt.Errorf("pack signature verification failed")
	}
	return nil
}

func InspectArchive(path string) (*ArchiveMetadata, error) {
	archivePath := filepath.Clean(strings.TrimSpace(path))
	if archivePath == "" {
		return nil, fmt.Errorf("pack path is required")
	}
	file, err := os.Open(archivePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	archiveDigest, err := sha256FileHex(archivePath)
	if err != nil {
		return nil, err
	}
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	decoder, err := zstd.NewReader(file)
	if err != nil {
		return nil, err
	}
	defer decoder.Close()
	reader := tar.NewReader(decoder)

	var manifestBytes []byte
	var checksumsBytes []byte
	for {
		header, nextErr := reader.Next()
		if nextErr == io.EOF {
			break
		}
		if nextErr != nil {
			return nil, nextErr
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}
		switch filepath.ToSlash(header.Name) {
		case "manifest.json":
			manifestBytes, err = io.ReadAll(reader)
			if err != nil {
				return nil, err
			}
		case "checksums.sha256":
			checksumsBytes, err = io.ReadAll(reader)
			if err != nil {
				return nil, err
			}
		}
	}
	if len(manifestBytes) == 0 {
		return nil, fmt.Errorf("manifest.json missing from archive")
	}
	if len(checksumsBytes) == 0 {
		return nil, fmt.Errorf("checksums.sha256 missing from archive")
	}

	var manifest packservice.Manifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return nil, err
	}

	manifestDigest := sha256Hex(manifestBytes)
	checksumsDigest := sha256Hex(checksumsBytes)
	return &ArchiveMetadata{
		PackID:          strings.TrimSpace(manifest.PackID),
		Version:         strings.TrimSpace(manifest.Version),
		ArchivePath:     archivePath,
		ArchiveSHA256:   archiveDigest,
		ManifestSHA256:  manifestDigest,
		ChecksumsSHA256: checksumsDigest,
		SizeBytes:       stat.Size(),
		Manifest:        &manifest,
	}, nil
}

func writeTarZstd(ctx context.Context, packDir string, outputPath string) error {
	files, err := archiveFileList(packDir)
	if err != nil {
		return err
	}
	out, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer out.Close()
	encoder, err := zstd.NewWriter(out)
	if err != nil {
		return err
	}
	defer encoder.Close()
	tw := tar.NewWriter(encoder)
	defer tw.Close()

	for _, rel := range files {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		fullPath := filepath.Join(packDir, filepath.FromSlash(rel))
		info, err := os.Stat(fullPath)
		if err != nil {
			return err
		}
		header := &tar.Header{
			Name:     rel,
			Size:     info.Size(),
			Mode:     0o644,
			Typeflag: tar.TypeReg,
			ModTime:  time.Unix(0, 0).UTC(),
			Format:   tar.FormatPAX,
		}
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		in, err := os.Open(fullPath)
		if err != nil {
			return err
		}
		_, err = io.Copy(tw, in)
		closeErr := in.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}

func archiveFileList(packDir string) ([]string, error) {
	required := []string{"manifest.json", "checksums.sha256"}
	for _, entry := range required {
		if _, err := os.Stat(filepath.Join(packDir, entry)); err != nil {
			return nil, fmt.Errorf("%s is required", entry)
		}
	}
	var files []string
	files = append(files, required...)
	dataRoot := filepath.Join(packDir, "data")
	if _, err := os.Stat(dataRoot); err == nil {
		err = filepath.WalkDir(dataRoot, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() {
				return nil
			}
			rel, err := filepath.Rel(packDir, path)
			if err != nil {
				return err
			}
			files = append(files, filepath.ToSlash(rel))
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	sort.Strings(files)
	return files, nil
}

func BuildRegistryEntry(meta *ArchiveMetadata, downloadURL, signatureURL string) (packservice.RegistryPack, error) {
	if meta == nil || meta.Manifest == nil {
		return packservice.RegistryPack{}, fmt.Errorf("archive metadata is required")
	}
	if strings.TrimSpace(downloadURL) == "" {
		return packservice.RegistryPack{}, fmt.Errorf("download URL is required")
	}
	manifest := meta.Manifest
	generatedAt := manifest.GeneratedAt
	if generatedAt.IsZero() {
		generatedAt = time.Now().UTC()
	}
	createdAt := manifest.CreatedAt
	if createdAt.IsZero() {
		createdAt = generatedAt
	}
	return packservice.RegistryPack{
		PackID:                strings.TrimSpace(manifest.PackID),
		Version:               strings.TrimSpace(manifest.Version),
		Name:                  strings.TrimSpace(manifest.Name),
		Description:           strings.TrimSpace(manifest.Description),
		SizeBytes:             meta.SizeBytes,
		CompressedSizeBytes:   meta.SizeBytes,
		AssetsCount:           manifest.AssetsCount,
		RowsCount:             manifest.RowsCount,
		Interval:              strings.TrimSpace(manifest.Interval),
		AssetTypes:            append([]string(nil), manifest.AssetTypes...),
		QuoteCurrencies:       append([]string(nil), manifest.QuoteCurrencies...),
		SourceProvider:        strings.TrimSpace(manifest.SourceProvider),
		DataLicense:           strings.TrimSpace(manifest.DataLicense),
		LicenseURL:            strings.TrimSpace(manifest.LicenseURL),
		RedistributionAllowed: manifest.RedistributionAllowed,
		CommercialUseAllowed:  manifest.CommercialUseAllowed,
		AttributionRequired:   manifest.AttributionRequired,
		GeneratedAt:           generatedAt,
		HistoryStart:          strings.TrimSpace(manifest.HistoryStart),
		HistoryEnd:            strings.TrimSpace(manifest.HistoryEnd),
		InstallMode:           "prebuilt",
		DownloadURL:           strings.TrimSpace(downloadURL),
		Checksum:              strings.TrimSpace(meta.ArchiveSHA256),
		ArchiveSHA256:         strings.TrimSpace(meta.ArchiveSHA256),
		SignatureURL:          strings.TrimSpace(signatureURL),
		CreatedAt:             createdAt,
	}, nil
}

func WriteRegistryEntry(path string, entry packservice.RegistryPack) error {
	file, err := os.Create(filepath.Clean(strings.TrimSpace(path)))
	if err != nil {
		return err
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(entry)
}

func parsePrivateKey(input string) (ed25519.PrivateKey, error) {
	raw, err := loadKeySpec(input)
	if err != nil {
		return nil, err
	}
	if block, _ := pem.Decode(raw); block != nil {
		key, parseErr := x509.ParsePKCS8PrivateKey(block.Bytes)
		if parseErr != nil {
			return nil, parseErr
		}
		ed, ok := key.(ed25519.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("private key is not ed25519")
		}
		return ed, nil
	}
	if key, ok := decodeRawPrivateKey(strings.TrimSpace(string(raw))); ok {
		return key, nil
	}
	return nil, fmt.Errorf("invalid ed25519 private key")
}

func parsePublicKey(input string) (ed25519.PublicKey, error) {
	body, err := loadKeySpec(input)
	if err != nil {
		return nil, err
	}
	cleaned := strings.TrimSpace(string(body))
	if block, _ := pem.Decode([]byte(cleaned)); block != nil {
		key, parseErr := x509.ParsePKIXPublicKey(block.Bytes)
		if parseErr != nil {
			return nil, parseErr
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

func decodeRawPrivateKey(cleaned string) (ed25519.PrivateKey, bool) {
	if decoded, err := hex.DecodeString(cleaned); err == nil {
		if key := privateKeyFromRaw(decoded); key != nil {
			return key, true
		}
	}
	if decoded, err := base64.StdEncoding.DecodeString(cleaned); err == nil {
		if key := privateKeyFromRaw(decoded); key != nil {
			return key, true
		}
	}
	return nil, false
}

func privateKeyFromRaw(raw []byte) ed25519.PrivateKey {
	switch len(raw) {
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(raw)
	case ed25519.PrivateKeySize:
		return ed25519.PrivateKey(raw)
	default:
		return nil
	}
}

func loadKeySpec(input string) ([]byte, error) {
	cleaned := strings.TrimSpace(input)
	if cleaned == "" {
		return nil, fmt.Errorf("signing key is required")
	}
	if stat, err := os.Stat(cleaned); err == nil && !stat.IsDir() {
		return os.ReadFile(cleaned)
	}
	return []byte(cleaned), nil
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

func sha256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func bytesTrimSpace(input []byte) []byte {
	return []byte(strings.TrimSpace(string(input)))
}
