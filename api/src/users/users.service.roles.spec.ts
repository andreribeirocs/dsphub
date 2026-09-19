import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

// better-auth/crypto e ESM e o jest deste projeto nao carrega ESM de
// node_modules. Nenhum teste aqui chega a criar senha - a permissao barra
// antes -, entao um duble basta e evita mexer na config do jest por causa de
// um import que estes testes nem exercitam.
jest.mock("better-auth/crypto", () => ({
  hashPassword: jest.fn(async () => "hash-de-mentira"),
}));

import { UsersService } from "./users.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { CreateUserDto, UpdateUserDto } from "./dto";
import { TenantContext } from "../tenancy/tenant-context";

/**
 * Editar passa pelo banco antes da trava (precisa carregar o alvo para saber
 * o papel dele), e toda consulta exige um DSP resolvido. Sem isto o teste
 * falharia por falta de contexto e nao por falta de permissao - que e
 * justamente o que ele quer medir.
 */
const noDsp = <T>(fn: () => T): T =>
  TenantContext.runForOrganization("org-de-teste", fn);

/**
 * Estes testes cobrem a escalada de privilegio que a matriz nova abriu.
 *
 * `users.manage` deixou de ser so do dono: pela planilha, recrutamento e
 * gerente geral tambem criam usuario. A partir daqui, quem pode criar ALGUEM
 * nao pode mais criar QUALQUER UM - e a checagem tem que valer nos dois
 * verbos, porque trocar a senha de um ADMIN que ja existe da o mesmo poder
 * que criar um.
 *
 * O Prisma e um objeto que explode se for tocado: se algum destes testes
 * passar batido pela trava, o erro vem do banco em vez de ForbiddenException,
 * e o teste falha de um jeito que se entende.
 */
const prismaQueNaoDeveSerUsado = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "A permissao deveria ter barrado ANTES de chegar no banco"
      );
    },
  }
) as PrismaService;

function servico() {
  return new UsersService(prismaQueNaoDeveSerUsado);
}

const criar = (role: UserRole): CreateUserDto =>
  ({
    email: "novo@dsp.test",
    name: "Novo",
    password: "irrelevante",
    role,
  }) as CreateUserDto;

describe("criar usuario respeita o papel ALVO, nao so o do ator", () => {
  it("recrutamento NAO cria ADMIN", async () => {
    // O buraco concreto: recrutador cria um ADMIN e tem a empresa inteira.
    await expect(
      servico().createUserFromDto(criar(UserRole.OWNER), {
        id: "u1",
        role: "MANAGER_RECRUITMENT",
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("recrutamento NAO cria o operador da plataforma", async () => {
    await expect(
      servico().createUserFromDto(criar(UserRole.SUPER_ADMIN), {
        id: "u1",
        role: "MANAGER_RECRUITMENT",
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("gerente geral NAO cria financeiro nem frota", async () => {
    for (const alvo of [UserRole.MANAGER_FINANCIAL, UserRole.MANAGER_FLEET]) {
      // GENERAL_MANAGER e papel NOVO - nao tem equivalente antigo. DIRECTOR
      // aqui seria ADMIN disfarcado, que cria qualquer um.
      await expect(
        servico().createUserFromDto(criar(alvo), {
          id: "u1",
          role: "GENERAL_MANAGER",
        })
      ).rejects.toThrow(ForbiddenException);
    }
  });

  it("OSM NAO cria outro OSM", async () => {
    await expect(
      servico().createUserFromDto(criar(UserRole.MANAGER_ONSITE), {
        id: "u1",
        role: "MANAGER_ONSITE",
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("sem ator identificado, nao cria nada", async () => {
    await expect(
      servico().createUserFromDto(criar(UserRole.DRIVER), undefined)
    ).rejects.toThrow(ForbiddenException);
  });

  it("o que a matriz permite passa da trava e chega no banco", async () => {
    // Aqui o Proxy do Prisma explode de proposito: e a prova de que a
    // permissao deixou passar, em vez de barrar silenciosamente tudo.
    await expect(
      servico().createUserFromDto(criar(UserRole.DRIVER), {
        id: "u1",
        role: "MANAGER_ONSITE",
      })
    ).rejects.toThrow(/deveria ter barrado ANTES/);
  });
});

describe("editar usuario tem a mesma trava que criar", () => {
  const alteracao = { name: "Outro Nome" } as UpdateUserDto;

  it("recrutamento nao edita um ADMIN que ja existe", async () => {
    // Sem isto a trava de criacao seria contornavel pelo outro lado: pego um
    // ADMIN existente, troco a senha e entro.
    const prisma = {
      user: { findFirst: async () => ({ id: "a1", role: UserRole.OWNER }) },
    } as unknown as PrismaService;

    await expect(
      noDsp(() =>
        new UsersService(prisma).updateUser("a1", alteracao, {
          id: "u1",
          role: "MANAGER_RECRUITMENT",
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it("OSM nao edita outro OSM", async () => {
    const prisma = {
      user: {
        findFirst: async () => ({ id: "o2", role: UserRole.MANAGER_ONSITE }),
      },
    } as unknown as PrismaService;

    await expect(
      noDsp(() =>
        new UsersService(prisma).updateUser("o2", alteracao, {
          id: "u1",
          role: "MANAGER_ONSITE",
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });
});
