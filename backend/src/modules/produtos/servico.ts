import { ClienteBanco } from '../../shared/prisma';
import type { IGestaoGateway } from '../../shared/gateways/gestao.gateway';
import type { OutboxPublisher } from '../../shared/messaging';
import { ProdutosRepositoryPrisma } from './produtos.repository';
import { ProdutosService } from './produtos.service';

export * from './produtos.entity';
export * from './produtos.repository';
export * from './produtos.service';

export class ServicoProdutosPrisma extends ProdutosService {
  constructor(
    prisma: ClienteBanco,
    gestaoGateway?: IGestaoGateway,
    outboxPublisher?: OutboxPublisher,
    usarMensageria?: boolean,
  ) {
    super(
      new ProdutosRepositoryPrisma(prisma),
      gestaoGateway,
      outboxPublisher,
      usarMensageria,
    );
  }
}
