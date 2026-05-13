package main
import (
"crypto/ed25519"
"encoding/hex"
"fmt"
)
func main() {
	raw, _ := hex.DecodeString("e2501a1c97a892b1a1c97a892b1a1c97a892b1a1c97a892b1a1c97a892b1a1c9")
	key := ed25519.NewKeyFromSeed(raw)
	fmt.Printf("Success! Private Key len: %d\n", len(key))
}
