import { ClienteBanco } from '../../shared/prisma';
import { UsuariosRepositoryPrisma } from './usuarios.repository';
import { ServicoUsuarios, UsuariosService } from './usuarios.service';

export * from './usuario.entity';
export * from './usuarios.repository';
export * from './usuarios.service';

export class ServicoUsuariosPrisma extends UsuariosService {
  constructor(prisma: ClienteBanco) {
    super(new UsuariosRepositoryPrisma(prisma));
  }
}
