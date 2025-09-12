export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl?: string;
}

interface Filters {
  page?: number | string | null;
  limit?: number | string | null;
  search?: string | null;
  categories?: string | string[] | null;
}

const sample: Product[] = Array.from({ length: 24 }).map((_, i) => ({
  id: i + 1,
  name: `Sample Product ${i + 1}`,
  category: ['beauty', 'electronics', 'clothing', 'home', 'sports'][i % 5],
  price: Math.round(1000 + Math.random() * 9000) / 100,
  description: 'Placeholder product for demo environment.'
}));

export const fakeProducts = {
  getProducts(filters: Filters) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 10);
    const search = (filters.search ?? '').toString().toLowerCase();
    const cats = Array.isArray(filters.categories)
      ? filters.categories
      : filters.categories
        ? [filters.categories]
        : [];

    let data = [...sample];
    if (search)
      data = data.filter((p) => p.name.toLowerCase().includes(search));
    if (cats.length) data = data.filter((p) => cats.includes(p.category));

    const total_products = data.length;
    const start = (page - 1) * limit;
    const products = data.slice(start, start + limit);
    return { total_products, products };
  },
  getProductById(id: number) {
    const product = sample.find((p) => p.id === id) || null;
    return { product };
  }
};
