/* global mermaid */
if (typeof mermaid === "undefined") {
  console.warn("Mermaid library not found. Add assets/vendor/mermaid.min.js.");
} else {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#fffdfa",
      primaryTextColor: "#1b2024",
      primaryBorderColor: "#d29a61",
      lineColor: "#d29a61",
      secondaryColor: "#f7efe5",
      tertiaryColor: "#fbf6ee",
      background: "#fffdfa",
      mainBkg: "#fffdfa",
      secondBkg: "#f7efe5",
      nodeBorder: "#d9cfc2",
      clusterBkg: "#f7efe5",
      clusterBorder: "#d9cfc2",
      titleColor: "#1b2024",
      edgeLabelBackground: "#fffdfa",
      nodeTextColor: "#1b2024",
    },
  });
}
