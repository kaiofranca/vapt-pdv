BEGIN;

INSERT INTO "produtos" ("nome", "categoria", "preco", "estoque", "estoque_minimo", "ativo", "criado_em", "atualizado_em")
SELECT p.nome, p.categoria, p.preco, p.estoque, p.estoque_minimo, p.ativo, NOW(), NOW()
FROM (VALUES
  ('X-Burger Artesanal', 'Lanches', 28.00::numeric, 45, 10, true),
  ('X-Bacon Especial', 'Lanches', 34.00::numeric, 35, 10, true),
  ('Smash Burger Duplo', 'Lanches', 32.00::numeric, 40, 10, true),
  ('Sanduíche de Frango Crocante', 'Lanches', 26.00::numeric, 30, 8, true),
  ('Burger Vegetariano de Grão de Bico', 'Lanches', 29.00::numeric, 20, 5, true),

  ('Batata Frita Rústica', 'Porções', 24.00::numeric, 60, 15, true),
  ('Batata com Cheddar e Bacon', 'Porções', 32.00::numeric, 45, 10, true),
  ('Isca de Peixe c/ Molho Tártaro', 'Porções', 48.00::numeric, 25, 5, true),
  ('Frango a Passarinho Crocante', 'Porções', 38.00::numeric, 30, 8, true),
  ('Pastelzinho Misto (6 unidades)', 'Porções', 22.00::numeric, 40, 10, true),
  ('Caldinho de Feijão com Bacon', 'Porções', 14.00::numeric, 50, 10, true),

  ('Chopp Artesanal Pilsen 500ml', 'Bebidas', 14.00::numeric, 120, 30, true),
  ('Chopp Artesanal IPA 500ml', 'Bebidas', 17.00::numeric, 80, 20, true),
  ('Cerveja Long Neck Heineken 330ml', 'Bebidas', 12.00::numeric, 96, 24, true),
  ('Refrigerante Coca-Cola Lata 350ml', 'Bebidas', 6.00::numeric, 150, 30, true),
  ('Refrigerante Guaraná Antarctica Lata', 'Bebidas', 6.00::numeric, 120, 24, true),
  ('Suco Natural de Laranja 400ml', 'Bebidas', 9.00::numeric, 40, 10, true),
  ('Água Mineral sem Gás 500ml', 'Bebidas', 4.50::numeric, 100, 20, true),
  ('Água Mineral com Gás 500ml', 'Bebidas', 5.00::numeric, 80, 20, true),

  ('Pudim de Leite Tradicional', 'Sobremesas', 12.00::numeric, 25, 5, true),
  ('Brownie com Sorvete de Baunilha', 'Sobremesas', 18.00::numeric, 30, 8, true),
  ('Petit Gâteau de Chocolate', 'Sobremesas', 22.00::numeric, 20, 5, true),

  ('Combo Burger + Fritas + Refri', 'Combos', 42.00::numeric, 30, 5, true),
  ('Combo Petisco + 2 Chopps', 'Combos', 65.00::numeric, 20, 5, true)
) AS p(nome, categoria, preco, estoque, estoque_minimo, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM "produtos" WHERE "produtos"."nome" = p.nome
);

COMMIT;
