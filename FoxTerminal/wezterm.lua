local wezterm = require("wezterm")

local config = {}

wezterm.on("format-window-title", function()
  return "FoxTerminal"
end)

config.color_scheme = "FoxNight"
config.font = wezterm.font("Cascadia Mono", { weight = "DemiBold" })
config.font_size = 13.0
config.line_height = 1.05
config.window_background_opacity = 0.92
config.macos_window_background_blur = 20
config.text_background_opacity = 1.0
config.scrollback_lines = 5000
config.hide_tab_bar_if_only_one_tab = true
config.use_fancy_tab_bar = false
config.tab_max_width = 25
config.tab_bar_at_bottom = true
config.window_padding = {
  left = 12,
  right = 12,
  top = 10,
  bottom = 10,
}
config.cursor_blink_rate = 0
config.default_cursor_style = "BlinkingBar"
config.window_decorations = "RESIZE"
config.window_frame = {
  font = wezterm.font("Cascadia Mono", { weight = "DemiBold" }),
  font_size = 12.0,
  active_titlebar_bg = "#0B0F1A",
  inactive_titlebar_bg = "#0B0F1A",
  active_titlebar_fg = "#E6E6E6",
  inactive_titlebar_fg = "#7A7A7A",
}

config.color_schemes = {
  FoxNight = {
    foreground = "#E6E6E6",
    background = "#0B0F1A",
    cursor_bg = "#7AA2F7",
    cursor_fg = "#0B0F1A",
    cursor_border = "#7AA2F7",
    selection_fg = "#E6E6E6",
    selection_bg = "#1F2937",
    scrollbar_thumb = "#3B4261",
    split = "#3B4261",
    ansi = {
      "#0B0F1A",
      "#FF6B6B",
      "#95F5A0",
      "#FBD38D",
      "#7AA2F7",
      "#BB9AF7",
      "#7DCFFF",
      "#E6E6E6",
    },
    brights = {
      "#3B4261",
      "#FF7A93",
      "#9ECE6A",
      "#E0AF68",
      "#7AA2F7",
      "#C0A7F7",
      "#7DCFFF",
      "#F2F2F2",
    },
  },
}

return config
