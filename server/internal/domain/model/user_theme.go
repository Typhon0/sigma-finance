package model

type ThemePreference string

const (
	ThemePreferenceLight  ThemePreference = "light"
	ThemePreferenceDark   ThemePreference = "dark"
	ThemePreferenceSystem ThemePreference = "system"
)

type ThemeBaseColor string

const (
	ThemeBaseColorNeutral ThemeBaseColor = "neutral"
	ThemeBaseColorStone   ThemeBaseColor = "stone"
	ThemeBaseColorZinc    ThemeBaseColor = "zinc"
	ThemeBaseColorMauve   ThemeBaseColor = "mauve"
	ThemeBaseColorOlive   ThemeBaseColor = "olive"
	ThemeBaseColorMist    ThemeBaseColor = "mist"
	ThemeBaseColorTaupe   ThemeBaseColor = "taupe"
)

type ThemeAccentColor string

const (
	ThemeAccentColorSlate   ThemeAccentColor = "slate"
	ThemeAccentColorGray    ThemeAccentColor = "gray"
	ThemeAccentColorZinc    ThemeAccentColor = "zinc"
	ThemeAccentColorNeutral ThemeAccentColor = "neutral"
	ThemeAccentColorStone   ThemeAccentColor = "stone"
	ThemeAccentColorRed     ThemeAccentColor = "red"
	ThemeAccentColorOrange  ThemeAccentColor = "orange"
	ThemeAccentColorAmber   ThemeAccentColor = "amber"
	ThemeAccentColorYellow  ThemeAccentColor = "yellow"
	ThemeAccentColorLime    ThemeAccentColor = "lime"
	ThemeAccentColorGreen   ThemeAccentColor = "green"
	ThemeAccentColorEmerald ThemeAccentColor = "emerald"
	ThemeAccentColorTeal    ThemeAccentColor = "teal"
	ThemeAccentColorCyan    ThemeAccentColor = "cyan"
	ThemeAccentColorSky     ThemeAccentColor = "sky"
	ThemeAccentColorBlue    ThemeAccentColor = "blue"
	ThemeAccentColorIndigo  ThemeAccentColor = "indigo"
	ThemeAccentColorViolet  ThemeAccentColor = "violet"
	ThemeAccentColorPurple  ThemeAccentColor = "purple"
	ThemeAccentColorFuchsia ThemeAccentColor = "fuchsia"
	ThemeAccentColorPink    ThemeAccentColor = "pink"
	ThemeAccentColorRose    ThemeAccentColor = "rose"
	ThemeAccentColorMauve   ThemeAccentColor = "mauve"
	ThemeAccentColorOlive   ThemeAccentColor = "olive"
	ThemeAccentColorMist    ThemeAccentColor = "mist"
	ThemeAccentColorTaupe   ThemeAccentColor = "taupe"
)

type ThemeFontPreference string

const (
	ThemeFontInter          ThemeFontPreference = "inter"
	ThemeFontNotoSans       ThemeFontPreference = "noto-sans"
	ThemeFontNunitoSans     ThemeFontPreference = "nunito-sans"
	ThemeFontFigtree        ThemeFontPreference = "figtree"
	ThemeFontRoboto         ThemeFontPreference = "roboto"
	ThemeFontRaleway        ThemeFontPreference = "raleway"
	ThemeFontDMSans         ThemeFontPreference = "dm-sans"
	ThemeFontPublicSans     ThemeFontPreference = "public-sans"
	ThemeFontOutfit         ThemeFontPreference = "outfit"
	ThemeFontJetBrainsMono  ThemeFontPreference = "jetbrains-mono"
	ThemeFontGeist          ThemeFontPreference = "geist"
	ThemeFontGeistMono      ThemeFontPreference = "geist-mono"
	ThemeFontLora           ThemeFontPreference = "lora"
	ThemeFontMerriweather   ThemeFontPreference = "merriweather"
	ThemeFontPlayfairDisplay ThemeFontPreference = "playfair-display"
	ThemeFontNotoSerif      ThemeFontPreference = "noto-serif"
	ThemeFontRobotoSlab     ThemeFontPreference = "roboto-slab"
	ThemeFontOxanium        ThemeFontPreference = "oxanium"
	ThemeFontManrope        ThemeFontPreference = "manrope"
	ThemeFontSpaceGrotesk   ThemeFontPreference = "space-grotesk"
	ThemeFontMontserrat     ThemeFontPreference = "montserrat"
	ThemeFontIBMPlexSans    ThemeFontPreference = "ibm-plex-sans"
	ThemeFontSourceSans3    ThemeFontPreference = "source-sans-3"
	ThemeFontInstrumentSans ThemeFontPreference = "instrument-sans"
	ThemeFontEBGaramond     ThemeFontPreference = "eb-garamond"
	ThemeFontInstrumentSerif ThemeFontPreference = "instrument-serif"
)

type ThemeHeadingFont string

const (
	ThemeHeadingFontInherit ThemeHeadingFont = "inherit"
)

type ThemeMenuAccent string

const (
	ThemeMenuAccentSubtle ThemeMenuAccent = "subtle"
	ThemeMenuAccentBold   ThemeMenuAccent = "bold"
)

type ThemeMenuColor string

const (
	ThemeMenuColorDefault           ThemeMenuColor = "default"
	ThemeMenuColorInverted          ThemeMenuColor = "inverted"
	ThemeMenuColorDefaultTranslucent ThemeMenuColor = "default-translucent"
	ThemeMenuColorInvertedTranslucent ThemeMenuColor = "inverted-translucent"
)

type ThemeStyle string

const (
	ThemeStyleVega ThemeStyle = "vega"
	ThemeStyleNova ThemeStyle = "nova"
	ThemeStyleMaia ThemeStyle = "maia"
	ThemeStyleLyra ThemeStyle = "lyra"
	ThemeStyleMira ThemeStyle = "mira"
	ThemeStyleLuma ThemeStyle = "luma"
	ThemeStyleSera ThemeStyle = "sera"
)

const (
	DefaultThemePreference     ThemePreference     = ThemePreferenceSystem
	DefaultThemeBaseColor      ThemeBaseColor      = ThemeBaseColorNeutral
	DefaultThemeAccentColor    ThemeAccentColor    = ThemeAccentColorZinc
	DefaultThemeFontPreference ThemeFontPreference = ThemeFontInter
	DefaultThemeHeadingFont    ThemeHeadingFont    = ThemeHeadingFontInherit
	DefaultThemeMenuAccent     ThemeMenuAccent     = ThemeMenuAccentSubtle
	DefaultThemeMenuColor      ThemeMenuColor      = ThemeMenuColorDefault
	DefaultThemeStyle          ThemeStyle          = ThemeStyleVega
	DefaultThemeRadius                            = 0.625
	MinThemeRadius                                = 0
	MaxThemeRadius                                = 1.2
	DefaultThemeRTL                               = false
)

type UserThemePreferences struct {
	ThemePreference     ThemePreference
	ThemeBaseColor      ThemeBaseColor
	ThemeAccentColor    ThemeAccentColor
	ThemeFontPreference ThemeFontPreference
	ThemeHeadingFont    ThemeHeadingFont
	ThemeMenuAccent     ThemeMenuAccent
	ThemeMenuColor      ThemeMenuColor
	ThemeStyle          ThemeStyle
	ThemeRadius         float64
	ThemeRTL            bool
}

func (p ThemePreference) IsValid() bool {
	switch p {
	case ThemePreferenceLight, ThemePreferenceDark, ThemePreferenceSystem:
		return true
	default:
		return false
	}
}

func (c ThemeBaseColor) IsValid() bool {
	switch c {
	case ThemeBaseColorNeutral,
		ThemeBaseColorStone,
		ThemeBaseColorZinc,
		ThemeBaseColorMauve,
		ThemeBaseColorOlive,
		ThemeBaseColorMist,
		ThemeBaseColorTaupe:
		return true
	default:
		return false
	}
}

func (c ThemeAccentColor) IsValid() bool {
	switch c {
	case ThemeAccentColorSlate,
		ThemeAccentColorGray,
		ThemeAccentColorZinc,
		ThemeAccentColorNeutral,
		ThemeAccentColorStone,
		ThemeAccentColorRed,
		ThemeAccentColorOrange,
		ThemeAccentColorAmber,
		ThemeAccentColorYellow,
		ThemeAccentColorLime,
		ThemeAccentColorGreen,
		ThemeAccentColorEmerald,
		ThemeAccentColorTeal,
		ThemeAccentColorCyan,
		ThemeAccentColorSky,
		ThemeAccentColorBlue,
		ThemeAccentColorIndigo,
		ThemeAccentColorViolet,
		ThemeAccentColorPurple,
		ThemeAccentColorFuchsia,
		ThemeAccentColorPink,
		ThemeAccentColorRose,
		ThemeAccentColorMauve,
		ThemeAccentColorOlive,
		ThemeAccentColorMist,
		ThemeAccentColorTaupe:
		return true
	default:
		return false
	}
}

func (f ThemeFontPreference) IsValid() bool {
	switch f {
	case ThemeFontInter,
		ThemeFontNotoSans,
		ThemeFontNunitoSans,
		ThemeFontFigtree,
		ThemeFontRoboto,
		ThemeFontRaleway,
		ThemeFontDMSans,
		ThemeFontPublicSans,
		ThemeFontOutfit,
		ThemeFontJetBrainsMono,
		ThemeFontGeist,
		ThemeFontGeistMono,
		ThemeFontLora,
		ThemeFontMerriweather,
		ThemeFontPlayfairDisplay,
		ThemeFontNotoSerif,
		ThemeFontRobotoSlab,
		ThemeFontOxanium,
		ThemeFontManrope,
		ThemeFontSpaceGrotesk,
		ThemeFontMontserrat,
		ThemeFontIBMPlexSans,
		ThemeFontSourceSans3,
		ThemeFontInstrumentSans,
		ThemeFontEBGaramond,
		ThemeFontInstrumentSerif:
		return true
	default:
		return false
	}
}

func (f ThemeHeadingFont) IsValid() bool {
	if f == ThemeHeadingFontInherit {
		return true
	}
	return ThemeFontPreference(f).IsValid()
}

func (m ThemeMenuAccent) IsValid() bool {
	switch m {
	case ThemeMenuAccentSubtle, ThemeMenuAccentBold:
		return true
	default:
		return false
	}
}

func (m ThemeMenuColor) IsValid() bool {
	switch m {
	case ThemeMenuColorDefault,
		ThemeMenuColorInverted,
		ThemeMenuColorDefaultTranslucent,
		ThemeMenuColorInvertedTranslucent:
		return true
	default:
		return false
	}
}

func (s ThemeStyle) IsValid() bool {
	switch s {
	case ThemeStyleVega,
		ThemeStyleNova,
		ThemeStyleMaia,
		ThemeStyleLyra,
		ThemeStyleMira,
		ThemeStyleLuma,
		ThemeStyleSera:
		return true
	default:
		return false
	}
}

func (p UserThemePreferences) Validate() error {
	if !p.ThemePreference.IsValid() {
		return NewValidationError("themePreference", "Invalid theme preference")
	}

	if !p.ThemeBaseColor.IsValid() {
		return NewValidationError("themeBaseColor", "Invalid theme base color")
	}

	if !p.ThemeAccentColor.IsValid() {
		return NewValidationError("themeAccentColor", "Invalid theme accent color")
	}

	if !p.ThemeFontPreference.IsValid() {
		return NewValidationError("themeFontPreference", "Invalid theme font preference")
	}

	if !p.ThemeHeadingFont.IsValid() {
		return NewValidationError("themeHeadingFont", "Invalid theme heading font")
	}

	if !p.ThemeMenuAccent.IsValid() {
		return NewValidationError("themeMenuAccent", "Invalid theme menu accent")
	}

	if !p.ThemeMenuColor.IsValid() {
		return NewValidationError("themeMenuColor", "Invalid theme menu color")
	}

	if !p.ThemeStyle.IsValid() {
		return NewValidationError("themeStyle", "Invalid theme style")
	}

	if p.ThemeRadius < MinThemeRadius || p.ThemeRadius > MaxThemeRadius {
		return NewValidationError("themeRadius", "Theme radius must be between 0 and 1.2")
	}

	return nil
}
