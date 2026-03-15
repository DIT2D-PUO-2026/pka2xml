import { defineConfig } from "vitepress";

const siteTitle = "pka2xml";
const siteDescription =
  "Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.";
const siteUrl = "https://dit2d-puo-2026.github.io/pka2xml/";
const previewImageUrl = `${siteUrl}meta.png`;

export default defineConfig({
  title: siteTitle,
  description: siteDescription,
  base: "/pka2xml/",

  head: [
    [
      "link",
      { rel: "icon", type: "image/svg+xml", href: "/pka2xml/favicon.svg" },
    ],

    // Open Graph
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: siteTitle }],
    ["meta", { property: "og:description", content: siteDescription }],
    ["meta", { property: "og:url", content: siteUrl }],
    ["meta", { property: "og:image", content: previewImageUrl }],
    ["meta", { property: "og:image:secure_url", content: previewImageUrl }],
    ["meta", { property: "og:image:type", content: "image/png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],

    // Twitter / X Card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: siteTitle }],
    ["meta", { name: "twitter:description", content: siteDescription }],
    ["meta", { name: "twitter:image", content: previewImageUrl }],
  ],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide" },
      { text: "Tool", link: "/tool" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/guide" },
          { text: "How It Works", link: "/guide#how-it-works" },
        ],
      },
      {
        text: "Tools",
        items: [{ text: "PKA / PKT Converter", link: "/tool" }],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/DIT2D-PUO-2026/pka2xml" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © pka2xml contributors",
    },

    search: {
      provider: "local",
    },
  },
});
