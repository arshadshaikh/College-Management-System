import { useState, useEffect } from 'react';
import { usePublicSite } from '../../context/PublicSiteContext';
import api from '../../api';

export default function PublicHome() {
  const { settings, college } = usePublicSite();
  const primary = settings.primary_color || '#1e40af';
  const [banners, setBanners] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/public/banners').then(({ data }) => setBanners(data)).catch(() => {});
    api.get('/public/announcements').then(({ data }) => setAnnouncements(data)).catch(() => {});
  }, []);

  const hero = banners[0];

  return (
    <div>
      {/* Hero banner */}
      {hero ? (
        <section className="relative">
          {hero.image_url && <img src={hero.image_url} alt={hero.title} className="w-full h-80 object-cover" />}
          <div className="absolute inset-0 bg-black/40 flex items-center">
            <div className="max-w-6xl mx-auto px-4 text-white">
              {hero.title && <h1 className="text-4xl font-bold">{hero.title}</h1>}
              {hero.subtitle && <p className="mt-2 text-lg opacity-90">{hero.subtitle}</p>}
              {hero.button_text && hero.link_url && (
                <a href={hero.link_url} className="inline-block mt-4 px-5 py-2 rounded-lg font-medium" style={{ background: primary }}>
                  {hero.button_text}
                </a>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="py-20 text-center" style={{ background: `${primary}10` }}>
          <div className="max-w-3xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-gray-900">Welcome to {college?.name}</h1>
            <p className="mt-3 text-gray-600">Admissions and information portal.</p>
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Announcements</h2>
          <div className="space-y-4">
            {announcements.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                {a.published_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(a.published_at).toLocaleDateString()}</p>}
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}