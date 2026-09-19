/**
 * Quem pode o que, num lugar so.
 *
 * Espalhar lista de papeis por controller torna a pergunta "quem ve dado
 * pessoal?" impossivel de responder sem ler o sistema inteiro - e essa e
 * exatamente a pergunta que uma fiscalizacao de GDPR faz. Aqui ela se responde
 * lendo um arquivo.
 *
 * TODA a matriz abaixo veio da planilha que o Andre preencheu e revisou linha
 * por linha (aba "Ver e Editar", 29 acoes, coluna "Revisei" = SIM em todas).
 * Nao ha suposicao minha aqui, com duas excecoes marcadas com
 * PENDENTE_CONFIRMACAO, onde a resposta dada abria um buraco e eu implementei
 * a leitura conservadora ate ele confirmar.
 *
 * Os nomes dos papeis mudaram. O banco ainda guarda os antigos (OWNER,
 * DIRECTOR, MANAGER_*), entao existe um mapa de traducao logo abaixo e tudo
 * aqui aceita os dois. Isso deixa a matriz funcionar HOJE, antes da migracao
 * que renomeia o enum - o mesmo padrao aditivo que usamos na ponte de
 * ServiceType: primeiro convive, depois tranca.
 */

export type Role =
  | "PLATFORM_ADMIN"
  | "ADMIN"
  | "GENERAL_MANAGER"
  | "ONSITE_MANAGER"
  | "FINANCE_MANAGER"
  | "FLEET_MANAGER"
  | "RECRUITMENT_MANAGER"
  | "DRIVER";

export const ALL_ROLES: readonly Role[] = [
  "PLATFORM_ADMIN",
  "ADMIN",
  "GENERAL_MANAGER",
  "ONSITE_MANAGER",
  "FINANCE_MANAGER",
  "FLEET_MANAGER",
  "RECRUITMENT_MANAGER",
  "DRIVER",
];

/**
 * O que esta gravado no banco hoje -> o nome novo.
 *
 * SUPER_ADMIN virou PLATFORM_ADMIN porque o papel nunca foi "o admin mais
 * forte da empresa": e quem opera a plataforma e NAO e funcionario do DSP.
 * OWNER e DIRECTOR se fundiram em ADMIN, que foi decisao explicita do Andre.
 */
export const LEGACY_ROLE_MAP: Readonly<Record<string, Role>> = {
  SUPER_ADMIN: "PLATFORM_ADMIN",
  OWNER: "ADMIN",
  DIRECTOR: "ADMIN",
  MANAGER_FINANCIAL: "FINANCE_MANAGER",
  MANAGER_FLEET: "FLEET_MANAGER",
  MANAGER_ONSITE: "ONSITE_MANAGER",
  MANAGER_RECRUITMENT: "RECRUITMENT_MANAGER",
  DRIVER: "DRIVER",
};

/** Aceita nome novo ou antigo e devolve sempre o novo. */
export function normaliseRole(role: string | undefined | null): Role | null {
  if (!role) return null;
  if ((ALL_ROLES as readonly string[]).includes(role)) return role as Role;
  return LEGACY_ROLE_MAP[role] ?? null;
}

/**
 * Capacidades que um usuario pode receber ALEM do papel dele.
 *
 * Existe porque o Andre descreveu um caso concreto que papel nenhum resolve:
 * "existem empresas que a operacao e pequena e o OSM faz o trabalho do
 * recrutamento em algumas partes". Criar um papel OSM_QUE_RECRUTA duplicaria a
 * matriz inteira para uma excecao; um adicional por usuario resolve sem
 * inventar hierarquia. Vale para qualquer papel, nao so OSM.
 */
export type ExtraCapability = Capability;

const TODOS = ALL_ROLES;

export const PERMISSIONS = {
  // ---------------------------------------------------------------- USUARIOS
  /** Ver quem sao os usuarios da empresa */
  "users.read": ["ADMIN", "GENERAL_MANAGER", "RECRUITMENT_MANAGER"],

  /** Criar usuario, trocar papel, senha, status, remover */
  "users.manage": ["ADMIN", "GENERAL_MANAGER", "RECRUITMENT_MANAGER"],

  // -------------------------------------------------------------- MOTORISTAS
  /** Ficha do motorista: quem e, onde trabalha, em que estado esta */
  "drivers.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
    "FLEET_MANAGER",
    "RECRUITMENT_MANAGER",
  ],

  /** Criar e editar motorista */
  "drivers.write": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "RECRUITMENT_MANAGER",
  ],

  /**
   * Documentos pessoais: carteira, passaporte, RTW, endereco.
   *
   * O ONSITE_MANAGER ficou de fora: toma conta do patio, nao precisa de
   * passaporte. Fleet entra por necessidade concreta - e quem transfere multa,
   * cobra avaria e confere se o seguro da van cobre quem vai dirigir.
   */
  "drivers.documents.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "FINANCE_MANAGER",
    "FLEET_MANAGER",
    "RECRUITMENT_MANAGER",
  ],

  /** Gerar o PDF de transferencia de multa (UK) */
  "drivers.fines.transfer": ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"],

  /**
   * Dossie de compliance completo - o que a Amazon pede numa auditoria.
   *
   * FLEET_MANAGER saiu daqui nesta revisao. Observacao do Andre na planilha:
   * "FLEET MANAGER - so o que for relacionado a vans". Ele continua com
   * drivers.documents.read, que e do que precisa para multa e seguro; o que
   * perde e a jornada, o historico de passagens e o pagamento.
   */
  "compliance.dossier.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "FINANCE_MANAGER",
    "RECRUITMENT_MANAGER",
  ],

  // ------------------------------------------------------------ RECRUTAMENTO
  "recruitment.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "RECRUITMENT_MANAGER",
  ],
  "recruitment.write": ["ADMIN", "GENERAL_MANAGER", "RECRUITMENT_MANAGER"],

  /**
   * Marcar CLASSROOM e CONTRATAR.
   *
   * O OSM nao entra pelo papel, mas o Andre pediu explicitamente que possa
   * entrar por usuario em operacao pequena. E para isso que serve
   * ExtraCapability: `can()` olha o papel E os adicionais do usuario.
   */
  "recruitment.classroom.mark": [
    "ADMIN",
    "GENERAL_MANAGER",
    "RECRUITMENT_MANAGER",
  ],
  "recruitment.hire": ["ADMIN", "GENERAL_MANAGER", "RECRUITMENT_MANAGER"],

  /** RIDE ALONG o OSM marca pelo papel - acontece no patio, com ele junto */
  "recruitment.ridealong.mark": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "RECRUITMENT_MANAGER",
  ],

  // ----------------------------------------------------------- ROTAS/ESCALA
  "routes.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "RECRUITMENT_MANAGER",
  ],
  "routes.write": ["ADMIN", "GENERAL_MANAGER", "ONSITE_MANAGER"],

  // ------------------------------------------------------------- PAGAMENTOS
  /**
   * Valores pagos por motorista.
   *
   * Recrutamento e fleet ficam de FORA de proposito: leem motorista e
   * documento, nao quanto cada um recebe.
   */
  "payments.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
  ],
  "payments.write": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
  ],

  /** Revisar/aprovar: o OSM lanca, quem aprova e outro. Separacao de funcao. */
  "payments.approve": ["ADMIN", "GENERAL_MANAGER", "FINANCE_MANAGER"],

  /** Subir o Service Details Report cru da Amazon */
  "payments.import.amazon": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
  ],

  /** Ver a conciliacao: o que a Amazon pagou vs o que devia, e o que reclamar */
  "payments.reconciliation.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
  ],

  /** Tarifas e tipos de servico - mexe no valor de todo mundo de uma vez */
  "payments.rates.write": ["ADMIN", "GENERAL_MANAGER", "FINANCE_MANAGER"],

  // ---------------------------------------------------------------- FATURAS
  "invoices.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
  ],

  /** Emitir self-billing invoice. O OSM NAO emite: e faturamento, nao patio. */
  "invoices.selfbilling.generate": [
    "ADMIN",
    "GENERAL_MANAGER",
    "FINANCE_MANAGER",
  ],

  // ------------------------------------------------------------------- VANS
  /**
   * O DRIVER entra aqui porque na 1.0 ele fica 24/7 com a van e e quem a leva
   * para manutencao - precisa enxergar o que esta agendado para ela.
   */
  "vans.read": [
    "ADMIN",
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FLEET_MANAGER",
    "DRIVER",
  ],

  /** Editar van e manutencao: so fleet. Nem o GENERAL_MANAGER, de proposito. */
  "vans.write": ["ADMIN", "FLEET_MANAGER"],

  // ---------------------------------------------------- O PROPRIO USUARIO
  /**
   * Escopo "meu". Todo papel pode - o que muda e que a consulta so devolve o
   * que e daquele usuario. Para quem nao e motorista vem vazio, e tudo bem:
   * a alternativa seria uma rota que existe so para um papel.
   */
  "self.invoices.read": [...TODOS],
  "self.contact.write": [...TODOS],

  // ---------------------------------------------------------------- SISTEMA
  "audit.read": ["ADMIN", "GENERAL_MANAGER", "FINANCE_MANAGER"],

  /** Configuracao da empresa: so ADMIN. O GENERAL_MANAGER nao mexe. */
  "settings.write": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof PERMISSIONS;

/**
 * PENDENTE_CONFIRMACAO #1 - dado pessoal e o operador da plataforma
 *
 * Na planilha o PLATFORM_ADMIN ficou SIM nas 29 linhas, inclusive documentos
 * pessoais, dossie de compliance e pagamento. Eu NAO coloquei ele na matriz
 * acima, e a razao e legal, nao tecnica: o operador da plataforma e outra
 * empresa que nao o DSP. O DSP e o controlador dos dados dos motoristas dele;
 * dar ao fornecedor de software acesso irrestrito a passaporte, endereco e
 * salario de todo motorista de todo cliente e o cenario que uma auditoria de
 * GDPR abre primeiro - e quem responde por isso e voce.
 *
 * A propria observacao do Andre na planilha diz do que ele precisa: "o
 * platform admin pode precisar da somatoria de self billing invoices emitidos
 * por cada empresa" - isso e numero agregado para cobrar pelo servico, nao
 * dado pessoal. Enquanto ele nao confirmar, PLATFORM_ADMIN so tem o que esta
 * aqui embaixo. Para dar tudo a ele, basta acrescentar "PLATFORM_ADMIN" nas
 * listas da matriz.
 */
export const PLATFORM_ADMIN_CAPABILITIES: readonly Capability[] = [
  "users.read",
  "users.manage",
  "audit.read",
  "settings.write",
];

/**
 * PENDENTE_CONFIRMACAO #2 - quem pode criar cada tipo de usuario
 *
 * Linha = quem cria. Veio da aba "Quem cria quem", com UMA alteracao.
 *
 * Na planilha a COLUNA PLATFORM_ADMIN ficou SIM em todas as linhas, o que lido
 * ao pe da letra diz que um DRIVER pode criar um PLATFORM_ADMIN. Isso e escada
 * de privilegio: a conta mais fraca do sistema fabrica a mais forte, e de
 * dentro dela faz o resto. Implementei a leitura conservadora - so
 * PLATFORM_ADMIN e ADMIN criam PLATFORM_ADMIN - e as linhas exatas estao
 * marcadas abaixo.
 *
 * RESOLVIDO em 19/09/2026 para o DRIVER: o Andre confirmou que "o driver nao
 * cria ninguem, provavel erro de preenchimento". A linha dele e definitiva.
 *
 * Os outros quatro papeis (GENERAL_MANAGER, ONSITE_MANAGER, FINANCE_MANAGER,
 * FLEET_MANAGER) seguem em aberto. A confirmacao do DRIVER reforca a tese de
 * arrastao na coluna inteira, mas ele so falou do DRIVER, entao os demais
 * continuam marcados em vez de decididos por inferencia.
 */
export const CAN_CREATE: Readonly<Record<Role, readonly Role[]>> = {
  PLATFORM_ADMIN: [...ALL_ROLES],
  ADMIN: [...ALL_ROLES],
  GENERAL_MANAGER: [
    // "PLATFORM_ADMIN",  <- PENDENTE_CONFIRMACAO #2
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "DRIVER",
  ],
  ONSITE_MANAGER: [
    // "PLATFORM_ADMIN",  <- PENDENTE_CONFIRMACAO #2
    "DRIVER",
  ],
  FINANCE_MANAGER: [
    // "PLATFORM_ADMIN",  <- PENDENTE_CONFIRMACAO #2
    "FINANCE_MANAGER",
    "DRIVER",
  ],
  FLEET_MANAGER: [
    // "PLATFORM_ADMIN",  <- PENDENTE_CONFIRMACAO #2
  ],
  RECRUITMENT_MANAGER: [
    // "PLATFORM_ADMIN",  <- PENDENTE_CONFIRMACAO #2
    "GENERAL_MANAGER",
    "ONSITE_MANAGER",
    "FINANCE_MANAGER",
    "FLEET_MANAGER",
    "RECRUITMENT_MANAGER",
    "DRIVER",
  ],
  /** Confirmado pelo Andre em 19/09/2026: motorista nao cria ninguem. */
  DRIVER: [],
};

/**
 * Os papeis que podem exercer uma capacidade, para passar ao @Roles.
 *
 * Devolve nome novo E nome antigo porque o banco ainda guarda os antigos. Sem
 * isso, trocar a matriz trancaria todo mundo para fora hoje.
 */
export function rolesFor(capability: Capability): string[] {
  const novos = new Set<string>(PERMISSIONS[capability] as readonly string[]);

  if (PLATFORM_ADMIN_CAPABILITIES.includes(capability)) {
    novos.add("PLATFORM_ADMIN");
  }

  const antigos = Object.entries(LEGACY_ROLE_MAP)
    .filter(([legado, novo]) => novos.has(novo) && legado !== novo)
    .map(([legado]) => legado);

  return [...novos, ...antigos];
}

/**
 * O usuario pode exercer a capacidade?
 *
 * `extras` sao as capacidades concedidas AQUELE usuario alem do papel - o caso
 * do OSM que tambem recruta numa operacao pequena.
 */
export function can(
  role: string | undefined | null,
  capability: Capability,
  extras: readonly ExtraCapability[] = []
): boolean {
  if (extras.includes(capability)) return true;

  const papel = normaliseRole(role);
  if (!papel) return false;

  if (papel === "PLATFORM_ADMIN") {
    return PLATFORM_ADMIN_CAPABILITIES.includes(capability);
  }

  return (PERMISSIONS[capability] as readonly string[]).includes(papel);
}

/** Este papel pode criar um usuario DAQUELE papel? */
export function canCreateRole(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  const ator = normaliseRole(actorRole);
  const alvo = normaliseRole(targetRole);
  if (!ator || !alvo) return false;
  return CAN_CREATE[ator].includes(alvo);
}

/** Os papeis que este usuario pode oferecer na tela de criar usuario. */
export function creatableRoles(actorRole: string | undefined | null): Role[] {
  const ator = normaliseRole(actorRole);
  if (!ator) return [];
  return [...CAN_CREATE[ator]];
}

/**
 * O que fica de fora do dossie para quem nao pode ver dinheiro.
 *
 * O dossie e um documento so, mas nem todo mundo que precisa dele precisa da
 * parte financeira. Quem nao alcanca recebe a mesma pagina com os valores
 * ausentes, em vez de uma pagina diferente - assim nao existe uma segunda
 * versao do dossie para manter em dia, e o que falta fica explicito para quem
 * esta lendo.
 */
export function dossierRedactionFor(role: string | undefined | null): {
  readonly includePayments: boolean;
  readonly includeInvoices: boolean;
  readonly note: string | null;
} {
  const money = can(role, "payments.read");
  const invoices = can(role, "invoices.read");

  return {
    includePayments: money,
    includeInvoices: invoices,
    note:
      money && invoices
        ? null
        : "Payment and invoice figures are omitted: your role covers driver " +
          "records and documents, not pay.",
  };
}
