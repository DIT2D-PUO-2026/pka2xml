import { defineConfig } from "vitepress";

const siteTitle = "pka2xml";
const siteDescription =
  "Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.";
const siteUrl = "https://dit2d-puo-2026.github.io/pka2xml/";
const previewImageUrl = `${siteUrl}meta.png`;
const previewImageAlt = "pka2xml – Packet Tracer File Converter preview";

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
    ["meta", { property: "og:site_name", content: siteTitle }],
    ["meta", { property: "og:title", content: siteTitle }],
    ["meta", { property: "og:description", content: siteDescription }],
    ["meta", { property: "og:image", content: previewImageUrl }],
    ["meta", { property: "og:image:secure_url", content: previewImageUrl }],
    ["meta", { property: "og:image:type", content: "image/png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: previewImageAlt }],

    // Twitter / X Card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: siteTitle }],
    ["meta", { name: "twitter:description", content: siteDescription }],
    ["meta", { name: "twitter:image", content: previewImageUrl }],
    ["meta", { name: "twitter:image:alt", content: previewImageAlt }],
  ],

  transformHead({ pageData }) {
    const path = pageData.relativePath
      .replace(/index\.md$/, "")
      .replace(/\.md$/, "/");
    return [["meta", { property: "og:url", content: `${siteUrl}${path}` }]];
  },

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide" },
      { text: "Tool", link: "/tool" },
      { text: "Patcher", link: "/patcher" },
      {
        text: "Activity Password",
        link: "/patcher#activity-wizard-password-recovery",
      },
      { text: "Trace Cleaner", link: "/cleaner" },
      { text: "Assessment Items", link: "/assessment" },
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
        items: [
          { text: "PKA / PKT Converter", link: "/tool" },
          { text: "PKA Patcher", link: "/patcher" },
          {
            text: "Activity Wizard Password",
            link: "/patcher#activity-wizard-password-recovery",
          },
          { text: "Trace Cleaner", link: "/cleaner" },
          { text: "Assessment Items", link: "/assessment" },
        ],
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
