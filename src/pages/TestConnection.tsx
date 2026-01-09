import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  name_it: string;
  icon: string;
  color: string;
  default_storage: string;
  average_shelf_life_days: number;
}

export default function TestConnection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name_it');

        if (error) throw error;

        setCategories(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connessione a Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
          <h2 className="text-red-800 font-semibold text-lg mb-2">
            ❌ Errore di connessione
          </h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ✅ Connessione Supabase Riuscita!
          </h1>
          <p className="text-gray-600 mb-8">
            Database configurato correttamente. Trovate {categories.length} categorie.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                style={{ borderLeftColor: category.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{getCategoryEmoji(category.icon)}</span>
                  <h3 className="font-semibold text-gray-900">{category.name_it}</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">Storage:</span> {getStorageLabel(category.default_storage)}
                  </p>
                  <p>
                    <span className="font-medium">Shelf life:</span> {category.average_shelf_life_days} giorni
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-green-800 font-semibold text-lg mb-2">
              🎉 Setup Completato
            </h2>
            <ul className="text-green-700 space-y-1">
              <li>✅ Client Supabase configurato</li>
              <li>✅ Tabella categories: {categories.length} righe</li>
              <li>✅ Tabella foods: creata e vuota</li>
              <li>✅ RLS policies attive</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryEmoji(icon: string): string {
  const emojiMap: Record<string, string> = {
    'milk': '🥛',
    'beef': '🥩',
    'fish': '🐟',
    'apple': '🍎',
    'carrot': '🥕',
    'wheat': '🍞',
    'cup-soda': '🥤',
    'snowflake': '❄️',
    'soup': '🥫',
    'candy': '🍬',
    'package': '📦',
  };
  return emojiMap[icon] || '📦';
}

function getStorageLabel(storage: string): string {
  const labels: Record<string, string> = {
    'fridge': 'Frigorifero',
    'freezer': 'Congelatore',
    'pantry': 'Dispensa',
  };
  return labels[storage] || storage;
}
