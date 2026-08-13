import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';

export default function PublicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/public/pages/${slug}`)
      .then(({ data }) => setPage(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (notFound) return <div className="py-20 text-center text-gray-500">Page not found.</div>;

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{page.title}</h1>
      {/* Content is admin-authored HTML */}
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: page.content }} />
    </article>
  );
}