import { ClienteBanco } from '../../shared/prisma';
import { ProdutosRepositoryPrisma } from './produtos.repository';
import { ProdutosService, ServicoProdutos } from './produtos.service';

export * from './produtos.entity';
export * from './produtos.repository';
export * from './produtos.service';

export class ServicoProdutosPrisma extends ProdutosService {
  constructor(prisma: ClienteBanco) {
    super(new ProdutosRepositoryPrisma(prisma));
  }
}
