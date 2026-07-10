/* Open off-site links in a new tab by default.

   Every anchor pointing at another origin gets target="_blank" and
   rel="noopener" stamped here, so external links need no per-link
   { target=_blank rel=noopener } attr_list — content only opts into the
   chain-link icon with { .external-link } (see extra.css). Anchors with
   an explicit target keep it.

   Idempotent and re-run via KilnUtils.onPageChange because
   navigation.instant replaces the content DOM on every page change. */

(function () {
  "use strict";

  function externalizeLinks() {
    document.querySelectorAll("a[href]").forEach(function (link) {
      if (link.protocol !== "http:" && link.protocol !== "https:") return;
      if (link.origin === location.origin) return;
      if (!link.target) link.target = "_blank";
      link.relList.add("noopener");
    });
  }

  KilnUtils.onPageChange(externalizeLinks);
})();
