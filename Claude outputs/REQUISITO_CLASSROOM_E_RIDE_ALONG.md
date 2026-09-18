# Requisito: Classroom, Ride Along e Driver Availability

**Data:** 18/09/2026  
**Contexto:** Integração entre Recruitment Pipeline e Driver Availability

---

## 📋 Fluxo de Status do Candidato

### Estágios no Recruitment
1. **Candidato Criado** → `PENDING`
   - Não aparece em Driver Availability
   - Aguarda Screening

2. **Passa Screening** → `PENDING`
   - Ainda não aparece em Driver Availability
   - Aguarda Classroom (treinamento em sala)

3. **Classroom Agendado** → `PENDING` (mesmo status, mas com flag)
   - ✅ Aparece em Driver Availability como "PENDING"
   - ❌ Onsite Manager NÃO consegue bookar rotas
   - ✅ Pode receber agendamentos de: Classroom, Ride Along
   - Quem marca Classroom: Recruitment
   - Quem marca Ride Along: Recruitment OU Onsite Manager

4. **Passa Ride Along** → `ACTIVE`
   - ✅ Aparece em Driver Availability como "ACTIVE"
   - ✅ Onsite Manager CONSEGUE bookar rotas normalmente
   - Status final do pipeline

---

## 🎯 Visibilidade no Driver Availability

### Candidato PENDING (Classroom Agendado)
```
Status: PENDING
Cor/Badge: Amarelo/Laranja
Pode agendar: Classroom, Ride Along
Pode bookar rotas: NÃO (bloqueado)
Quem vê: Recruitment + Onsite Manager
```

### Candidato ACTIVE (Passou Ride Along)
```
Status: ACTIVE
Cor/Badge: Verde
Pode agendar: Rotas, qualquer dia
Pode bookar rotas: SIM (normal)
Quem vê: Recruitment + Onsite Manager
```

---

## 👥 Permissões de Agendamento

| Ação | Recruitment | Onsite Manager |
|------|------------|-----------------|
| Marcar Classroom | ✅ SIM | ❌ NÃO |
| Marcar Ride Along | ✅ SIM | ✅ SIM |
| Bookar Rotas (ACTIVE) | ❌ NÃO | ✅ SIM |
| Visualizar Pipeline | ✅ SIM | ✅ SIM (leitura) |

---

## 🐛 Issue: Drivers Fictícios Archived

**Problema:** Drivers fictícios com status `ARCHIVED` no Recruitment Management não aparecem na tela.

**Possível causa:** Filtro padrão exclui `ARCHIVED`

**Ação requerida:** Verificar se há:
1. Um filtro ativo escondendo archived
2. Uma flag de show/hide archived
3. Query que filtra `status != 'ARCHIVED'` por padrão

**Esperado:** Usuário conseguir ver (ou filtrar pra) drivers archived, talvez com opção:
- [ ] Mostrar apenas ativos (padrão)
- [ ] Mostrar apenas archived
- [ ] Mostrar tudo

---

## 📝 Resumo para Implementação

- **Classroom é o gatilho:** quando marcado em Recruitment → candidato fica visível em Driver Availability como PENDING
- **Ride Along é o confirmador:** quando concluído → candidato vira ACTIVE
- **Bloqueio de rotas:** PENDING não pode bookar; ACTIVE pode
- **Problema parallel:** drivers archived não estão visíveis no Recruitment Management
