export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  stock?: number;
  createdAt?: string;
  updatedAt?: string;
}
