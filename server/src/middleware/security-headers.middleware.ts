// The security headers of every answer: what a browser may load in our pages,
// and what it must refuse. The pages load nothing from another site: their
// scripts, styles and images are ours, the API is at the same address, and
// what goes elsewhere (eva.gg, Discord) goes by a link, never loaded in.
// Helmet adds the rest of the usual set: no guessing of content types, no
// X-Powered-By, no referrer sent to the sites we link to, our windows kept
// apart from other sites'.

import helmet from 'helmet';

const SELF = "'self'";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    // No upgrade-insecure-requests: every address in our pages is our own,
    // which HSTS keeps on HTTPS, and it would break a run of the build on a
    // plain http://localhost
    useDefaults: false,
    directives: {
      defaultSrc: [SELF],
      scriptSrc: [SELF],
      scriptSrcAttr: ["'none'"],
      // Vue sets the styles it binds through the style object, which a policy
      // does not block; no style is written in a page or inserted as markup
      styleSrc: [SELF],
      // data: for the textures a theme draws in its stylesheet
      imgSrc: [SELF, 'data:'],
      fontSrc: [SELF],
      connectSrc: [SELF],
      objectSrc: ["'none'"],
      baseUri: [SELF],
      formAction: [SELF],
      frameAncestors: ["'none'"],
    },
  },
  // A page of ours inside another site's frame is never ours to show
  xFrameOptions: { action: 'deny' },
  // HTTPS for a year, on our own addresses only: whatever else lives under
  // the domain is not ours to force
  strictTransportSecurity: { maxAge: 365 * 24 * 60 * 60, includeSubDomains: false },
});
