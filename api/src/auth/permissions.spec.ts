import {
  can,
  canCreateRole,
  creatableRoles,
  rolesFor,
  normaliseRole,
  dossierRedactionFor,
  ALL_ROLES,
  CAN_CREATE,
  PERMISSIONS,
  type Capability,
} from "./permissions";

const CAPS = Object.keys(PERMISSIONS) as Capability[];

describe("nomes antigos continuam valendo enquanto o banco nao migra", () => {
  it("traduz cada nome antigo para o novo", () => {
    expect(normaliseRole("SUPER_ADMIN")).toBe("PLATFORM_ADMIN");
    expect(normaliseRole("OWNER")).toBe("ADMIN");
    expect(normaliseRole("DIRECTOR")).toBe("ADMIN");
    expect(normaliseRole("MANAGER_ONSITE")).toBe("ONSITE_MANAGER");
    expect(normaliseRole("MANAGER_FINANCIAL")).toBe("FINANCE_MANAGER");
    expect(normaliseRole("MANAGER_FLEET")).toBe("FLEET_MANAGER");
    expect(normaliseRole("MANAGER_RECRUITMENT")).toBe("RECRUITMENT_MANAGER");
  });

  it("nome antigo e nome novo dao exatamente o mesmo acesso", () => {
    // Se divergirem, um usuario perde acesso no dia da migracao sem ninguem
    // perceber - e o jeito de descobrir seria ele ligando.
    const pares: [string, string][] = [
      ["OWNER", "ADMIN"],
      ["DIRECTOR", "ADMIN"],
      ["MANAGER_ONSITE", "ONSITE_MANAGER"],
      ["MANAGER_FINANCIAL", "FINANCE_MANAGER"],
      ["MANAGER_FLEET", "FLEET_MANAGER"],
      ["MANAGER_RECRUITMENT", "RECRUITMENT_MANAGER"],
      ["SUPER_ADMIN", "PLATFORM_ADMIN"],
    ];
    for (const [antigo, novo] of pares) {
      for (const cap of CAPS) {
        expect([antigo, cap, can(antigo, cap)]).toEqual([
          antigo,
          cap,
          can(novo, cap),
        ]);
      }
    }
  });

  it("papel desconhecido ou ausente nao alcanca nada", () => {
    for (const cap of CAPS) {
      expect(can(undefined, cap)).toBe(false);
      expect(can("", cap)).toBe(false);
      expect(can("PAPEL_INVENTADO", cap)).toBe(false);
    }
  });

  it("rolesFor entrega nome novo E antigo, para o @Roles casar hoje", () => {
    const r = rolesFor("compliance.dossier.read");
    expect(r).toContain("RECRUITMENT_MANAGER");
    expect(r).toContain("MANAGER_RECRUITMENT");
    expect(r).toContain("ADMIN");
    expect(r).toContain("OWNER");
    expect(r).toContain("DIRECTOR");
    expect(r).not.toContain("DRIVER");
  });
});

describe("matriz que o Andre revisou linha por linha", () => {
  it("fleet le documento pessoal, mas NAO abre o dossie de compliance", () => {
    // Mudou nesta revisao. Observacao dele: "so o que for relacionado a vans".
    // Carteira e endereco ele precisa para multa e seguro; jornada, historico
    // de passagens e pagamento nao sao assunto de frota.
    expect(can("FLEET_MANAGER", "drivers.documents.read")).toBe(true);
    expect(can("FLEET_MANAGER", "drivers.fines.transfer")).toBe(true);
    expect(can("FLEET_MANAGER", "compliance.dossier.read")).toBe(false);
  });

  it("fleet nao ve dinheiro, e e o unico que edita van", () => {
    expect(can("FLEET_MANAGER", "payments.read")).toBe(false);
    expect(can("FLEET_MANAGER", "invoices.read")).toBe(false);
    expect(can("FLEET_MANAGER", "vans.write")).toBe(true);
    // Nem o gerente geral mexe na frota - foi resposta explicita na planilha.
    expect(can("GENERAL_MANAGER", "vans.write")).toBe(false);
  });

  it("recrutamento ve motorista, documento e dossie - mas nunca pagamento", () => {
    expect(can("RECRUITMENT_MANAGER", "drivers.documents.read")).toBe(true);
    expect(can("RECRUITMENT_MANAGER", "compliance.dossier.read")).toBe(true);
    expect(can("RECRUITMENT_MANAGER", "payments.read")).toBe(false);
    expect(can("RECRUITMENT_MANAGER", "invoices.read")).toBe(false);
  });

  it("onsite manager cuida do patio: sem documento pessoal, sem faturar", () => {
    expect(can("ONSITE_MANAGER", "routes.write")).toBe(true);
    expect(can("ONSITE_MANAGER", "payments.write")).toBe(true);
    expect(can("ONSITE_MANAGER", "payments.import.amazon")).toBe(true);
    expect(can("ONSITE_MANAGER", "drivers.documents.read")).toBe(false);
    expect(can("ONSITE_MANAGER", "compliance.dossier.read")).toBe(false);
    expect(can("ONSITE_MANAGER", "invoices.selfbilling.generate")).toBe(false);
    // Lanca o pagamento, mas nao aprova o proprio lancamento.
    expect(can("ONSITE_MANAGER", "payments.approve")).toBe(false);
  });

  it("quem lanca pagamento nao e quem aprova", () => {
    expect(can("ONSITE_MANAGER", "payments.write")).toBe(true);
    expect(can("ONSITE_MANAGER", "payments.approve")).toBe(false);
    expect(can("FINANCE_MANAGER", "payments.approve")).toBe(true);
  });

  it("gerente geral alcanca quase tudo, menos frota e configuracao", () => {
    expect(can("GENERAL_MANAGER", "invoices.selfbilling.generate")).toBe(true);
    expect(can("GENERAL_MANAGER", "compliance.dossier.read")).toBe(true);
    expect(can("GENERAL_MANAGER", "vans.write")).toBe(false);
    expect(can("GENERAL_MANAGER", "settings.write")).toBe(false);
  });

  it("so o ADMIN mexe na configuracao da empresa", () => {
    for (const role of ALL_ROLES) {
      if (role === "ADMIN" || role === "PLATFORM_ADMIN") continue;
      expect([role, can(role, "settings.write")]).toEqual([role, false]);
    }
  });

  it("motorista ve a van e o que e dele, e mais nada", () => {
    expect(can("DRIVER", "vans.read")).toBe(true);
    expect(can("DRIVER", "self.invoices.read")).toBe(true);
    expect(can("DRIVER", "self.contact.write")).toBe(true);

    expect(can("DRIVER", "vans.write")).toBe(false);
    expect(can("DRIVER", "drivers.read")).toBe(false);
    expect(can("DRIVER", "drivers.documents.read")).toBe(false);
    expect(can("DRIVER", "compliance.dossier.read")).toBe(false);
    expect(can("DRIVER", "payments.read")).toBe(false);
    expect(can("DRIVER", "invoices.read")).toBe(false);
    expect(can("DRIVER", "users.read")).toBe(false);
    expect(can("DRIVER", "audit.read")).toBe(false);
  });

  it("nenhum papel fica sem nada para fazer", () => {
    // Coluna inteira em NAO quase sempre e erro de preenchimento, nao decisao.
    for (const role of ALL_ROLES) {
      const quantas = CAPS.filter((c) => can(role, c)).length;
      expect([role, quantas > 0]).toEqual([role, true]);
    }
  });
});

describe("capacidade extra por usuario (o OSM que tambem recruta)", () => {
  it("por papel o OSM nao marca classroom nem contrata", () => {
    expect(can("ONSITE_MANAGER", "recruitment.classroom.mark")).toBe(false);
    expect(can("ONSITE_MANAGER", "recruitment.hire")).toBe(false);
  });

  it("com a capacidade concedida ao usuario, passa a poder", () => {
    // Operacao pequena onde o OSM faz parte do recrutamento. Resolve sem criar
    // um papel novo que duplicaria a matriz inteira por causa de uma excecao.
    const extras = ["recruitment.classroom.mark", "recruitment.hire"] as const;
    expect(can("ONSITE_MANAGER", "recruitment.classroom.mark", extras)).toBe(true);
    expect(can("ONSITE_MANAGER", "recruitment.hire", extras)).toBe(true);
  });

  it("o extra concede so o que foi concedido", () => {
    const extras = ["recruitment.classroom.mark"] as const;
    expect(can("ONSITE_MANAGER", "recruitment.hire", extras)).toBe(false);
    expect(can("ONSITE_MANAGER", "payments.approve", extras)).toBe(false);
    expect(can("DRIVER", "compliance.dossier.read", extras)).toBe(false);
  });

  it("RIDE ALONG o OSM ja marca pelo papel, sem precisar de extra", () => {
    expect(can("ONSITE_MANAGER", "recruitment.ridealong.mark")).toBe(true);
  });
});

describe("operador da plataforma nao e funcionario do DSP", () => {
  it("administra a plataforma", () => {
    expect(can("PLATFORM_ADMIN", "users.manage")).toBe(true);
    expect(can("PLATFORM_ADMIN", "audit.read")).toBe(true);
    expect(can("PLATFORM_ADMIN", "settings.write")).toBe(true);
  });

  it("NAO alcanca dado pessoal nem salario de motorista", () => {
    // PENDENTE_CONFIRMACAO #1. O DSP e o controlador dos dados; o fornecedor
    // de software com acesso irrestrito a passaporte, endereco e pagamento de
    // todo motorista de todo cliente e o primeiro achado de uma auditoria.
    expect(can("PLATFORM_ADMIN", "drivers.documents.read")).toBe(false);
    expect(can("PLATFORM_ADMIN", "compliance.dossier.read")).toBe(false);
    expect(can("PLATFORM_ADMIN", "payments.read")).toBe(false);
    expect(can("PLATFORM_ADMIN", "invoices.read")).toBe(false);
  });
});

describe("quem cria quem", () => {
  it("ADMIN cria qualquer papel", () => {
    for (const alvo of ALL_ROLES) {
      expect([alvo, canCreateRole("ADMIN", alvo)]).toEqual([alvo, true]);
    }
  });

  it("ninguem abaixo do ADMIN cria PLATFORM_ADMIN", () => {
    // PENDENTE_CONFIRMACAO #2. Na planilha a coluna inteira ficou SIM, o que
    // deixaria um DRIVER fabricando a conta mais forte do sistema.
    for (const ator of ALL_ROLES) {
      if (ator === "ADMIN" || ator === "PLATFORM_ADMIN") continue;
      expect([ator, canCreateRole(ator, "PLATFORM_ADMIN")]).toEqual([
        ator,
        false,
      ]);
    }
  });

  it("gerente geral cria OSM e motorista, nao cria financeiro nem frota", () => {
    expect(canCreateRole("GENERAL_MANAGER", "ONSITE_MANAGER")).toBe(true);
    expect(canCreateRole("GENERAL_MANAGER", "DRIVER")).toBe(true);
    expect(canCreateRole("GENERAL_MANAGER", "FINANCE_MANAGER")).toBe(false);
    expect(canCreateRole("GENERAL_MANAGER", "FLEET_MANAGER")).toBe(false);
    expect(canCreateRole("GENERAL_MANAGER", "ADMIN")).toBe(false);
  });

  it("OSM so cria motorista", () => {
    expect(creatableRoles("ONSITE_MANAGER")).toEqual(["DRIVER"]);
  });

  it("motorista nao cria ninguem - confirmado, nao e mais suposicao", () => {
    // Andre, 19/09/2026: "o driver nao cria ninguem, provavel erro de
    // preenchimento". A planilha dizia que ele criava PLATFORM_ADMIN.
    expect(creatableRoles("DRIVER")).toEqual([]);
    for (const alvo of ALL_ROLES) {
      expect([alvo, canCreateRole("DRIVER", alvo)]).toEqual([alvo, false]);
    }
  });

  it("frota nao cria ninguem", () => {
    expect(creatableRoles("FLEET_MANAGER")).toEqual([]);
  });

  it("ninguem cria um ADMIN sem ser ADMIN", () => {
    for (const ator of ALL_ROLES) {
      if (ator === "ADMIN" || ator === "PLATFORM_ADMIN") continue;
      expect([ator, canCreateRole(ator, "ADMIN")]).toEqual([ator, false]);
    }
  });

  it("aceita nome antigo dos dois lados", () => {
    expect(canCreateRole("OWNER", "MANAGER_FLEET")).toBe(true);
    expect(canCreateRole("MANAGER_ONSITE", "DRIVER")).toBe(true);
    expect(canCreateRole("MANAGER_ONSITE", "MANAGER_FINANCIAL")).toBe(false);
  });

  it("quem cria OUTRO USUARIO tambem enxerga a lista de usuarios", () => {
    // Criar um usuario sem poder abrir a tela de usuarios e uma tela morta.
    //
    // Criar DRIVER nao conta: motorista e cadastro operacional (drivers.write),
    // nao conta de acesso - o OSM cria motorista o dia inteiro sem nunca
    // precisar da tela de usuarios.
    //
    // FINANCE_MANAGER esta de fora porque a planilha se contradiz nele: na aba
    // "Quem cria quem" ele cria outro FINANCE_MANAGER, mas em "Ver e Editar"
    // users.read ficou NAO. Um dos dois esta errado e so o Andre decide qual.
    // Quando ele responder, esta excecao sai e o teste passa a cobri-lo.
    const PENDENTE_CONFIRMACAO_3: readonly string[] = ["FINANCE_MANAGER"];

    for (const ator of ALL_ROLES) {
      if (PENDENTE_CONFIRMACAO_3.includes(ator)) continue;
      const criaConta = CAN_CREATE[ator].some((alvo) => alvo !== "DRIVER");
      if (!criaConta) continue;
      expect([ator, can(ator, "users.read")]).toEqual([ator, true]);
    }
  });

  it("o conflito do FINANCE_MANAGER segue em aberto, e isto o documenta", () => {
    // Este teste existe para o conflito nao virar "ninguem lembrou".
    expect(canCreateRole("FINANCE_MANAGER", "FINANCE_MANAGER")).toBe(true);
    expect(can("FINANCE_MANAGER", "users.read")).toBe(false);
  });
});

describe("recorte do dossie por papel", () => {
  it("quem alcanca dinheiro ve o dossie inteiro", () => {
    for (const role of ["ADMIN", "GENERAL_MANAGER", "FINANCE_MANAGER"]) {
      const r = dossierRedactionFor(role);
      expect([role, r.includePayments, r.includeInvoices, r.note]).toEqual([
        role,
        true,
        true,
        null,
      ]);
    }
  });

  it("recrutamento recebe o dossie sem valores, e o documento diz isso", () => {
    // Um recorte silencioso faria quem le acreditar que a pessoa nao
    // trabalhou nenhum dia.
    const r = dossierRedactionFor("RECRUITMENT_MANAGER");
    expect(r.includePayments).toBe(false);
    expect(r.includeInvoices).toBe(false);
    expect(r.note).toMatch(/omitted/);
  });
});
