// frontend-next/src/components/seo/JsonLd.jsx
const safeJsonLdStringify = (data) => {
  try {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  } catch (error) {
    console.error('[JsonLd] stringify failed:', error?.message || error);
    return '';
  }
};

export default function JsonLd({ data }) {
  if (!data) return null;

  const json = safeJsonLdStringify(data);
  if (!json) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
