// src/components/seo/SEO.jsx
import useSEO from '../../hooks/useSEO';

/**
 * Declarative wrapper around useSEO(). Renders nothing.
 *
 * Static page:
 *   <SEO title="Privacy Policy" description="How we handle your data." />
 *
 * Dynamic page — hold the previous/default tags until the data lands:
 *   <SEO
 *     enabled={!loading && !!report}
 *     title={report ? `Case #${report.reference} — ${report.title}` : ''}
 *     description={report?.summary}
 *     noIndex
 *   />
 *
 * Authenticated screens should always pass `noIndex`.
 */
const SEO = (props) => {
  useSEO(props);
  return null;
};

export default SEO;
