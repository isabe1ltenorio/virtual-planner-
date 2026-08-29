// P-23: servico de relatorios. Os cenarios seguem docs/reporting-metrics-data.md
// e as formulas seguem docs/reporting-metrics-contract.md.
#include "virtual_planner/application/reporting/reporting_service.hpp"

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_goal_repository.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"

#include <chrono>
#include <cstdint>
#include <stdexcept>
#include <string>

using namespace virtual_planner;
namespace reporting = virtual_planner::application::reporting;

namespace
{

domain::Goal make_goal(domain::Category category,
                       domain::GoalStatus status,
                       const domain::Date& reference_date)
{
    return domain::Goal{
        0, "meta", category, status, domain::GoalPeriod::Weekly, reference_date};
}

domain::Task make_task(std::uint64_t id,
                       domain::Category category,
                       domain::TaskStatus status,
                       const domain::Date& date,
                       std::chrono::hours start = std::chrono::hours{9})
{
    return domain::Task{
        id,
        "tarefa",
        category,
        date,
        domain::TimeSlot{start, start + std::chrono::hours{1}},
        domain::Priority::Medium,
        status};
}

// Dono usado por todo o arquivo. O relatorio e sempre de alguem: nao ha
// valor que signifique "a base inteira" (issue #113).
constexpr std::uint64_t kOwner = 1;
constexpr std::uint64_t kOtherUser = 2;

reporting::ReportRequest window(const domain::Date& start, const domain::Date& end)
{
    return reporting::ReportRequest{start, end, kOwner};
}

const reporting::BucketScore* find_bucket(
    const std::vector<reporting::BucketScore>& buckets, const std::string& label)
{
    for (const auto& bucket : buckets)
    {
        if (bucket.label == label)
        {
            return &bucket;
        }
    }

    return nullptr;
}

bool has_label(const std::vector<reporting::BucketScore>& buckets,
               const std::string& label)
{
    return find_bucket(buckets, label) != nullptr;
}

} // namespace

int main()
{
    // --- Turno derivado do inicio do TimeSlot -------------------------------
    {
        using domain::TimeSlot;
        using std::chrono::hours;
        using std::chrono::minutes;

        VP_EXPECT(reporting::shift_of(TimeSlot{minutes{0}, hours{1}}) == domain::Shift::Morning,
                  "meia-noite deve cair em Morning");
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{11}, hours{12}}) == domain::Shift::Morning,
                  "11h deve cair em Morning");
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{12}, hours{13}}) == domain::Shift::Afternoon,
                  "12h em ponto ja e Afternoon");
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{17}, hours{18}}) == domain::Shift::Afternoon,
                  "17h deve cair em Afternoon");
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{18}, hours{19}}) == domain::Shift::Evening,
                  "18h em ponto ja e Evening");
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{23}, hours{24}}) == domain::Shift::Evening,
                  "23h deve cair em Evening");

        // A regra do contrato: quem atravessa turnos conta no turno em que
        // COMECA. Das 11h as 15h e Morning, nao Afternoon nem os dois.
        VP_EXPECT(reporting::shift_of(TimeSlot{hours{11}, hours{15}}) == domain::Shift::Morning,
                  "uma tarefa que atravessa turnos conta no turno em que comeca");
    }

    // --- Periodo sem dados nenhum -------------------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;
        reporting::ReportingService service{goals, tasks};

        const auto summary = service.execute(
            window(domain::Date{1, 8, 2026}, domain::Date{31, 8, 2026}));

        VP_EXPECT(summary.goals_total == 0, "sem metas o total deve ser zero");
        VP_EXPECT(summary.tasks_total == 0, "sem tarefas o total deve ser zero");
        VP_EXPECT(!summary.goals_ratio.has_value(),
                  "sem metas a razao deve ser nula, e nao zero");
        VP_EXPECT(!summary.tasks_ratio.has_value(),
                  "sem tarefas a razao deve ser nula, e nao zero");
        VP_EXPECT(!summary.productivity_index.has_value(),
                  "sem dado nenhum o indicador geral deve ser nulo");
        VP_EXPECT(summary.most_productive_weeks.empty(), "sem tarefas nao ha semana produtiva");
        VP_EXPECT(summary.most_productive_months.empty(), "sem tarefas nao ha mes produtivo");
        VP_EXPECT(summary.most_productive_shifts.empty(), "sem tarefas nao ha turno produtivo");
        VP_EXPECT(summary.task_categories.empty(), "sem tarefas nao ha categoria");
        VP_EXPECT(summary.goal_categories.empty(), "sem metas nao ha categoria");
    }

    // --- Dados existem, mas todos FORA do periodo ---------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        goals.save(make_goal(domain::Category::Study, domain::GoalStatus::Completed,
                             domain::Date{15, 7, 2026}), kOwner);
        tasks.save(make_task(1, domain::Category::Study, domain::TaskStatus::Executed,
                             domain::Date{15, 9, 2026}), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 8, 2026}, domain::Date{31, 8, 2026}));

        VP_EXPECT(summary.goals_total == 0, "meta fora do periodo nao deve entrar");
        VP_EXPECT(summary.tasks_total == 0, "tarefa fora do periodo nao deve entrar");
        VP_EXPECT(!summary.productivity_index.has_value(),
                  "periodo vazio continua com indicador nulo mesmo havendo dados fora dele");
    }

    // --- Bordas do periodo sao inclusivas -----------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        tasks.save(make_task(1, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{1, 8, 2026}), kOwner);   // exatamente o inicio
        tasks.save(make_task(2, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{31, 8, 2026}), kOwner);  // exatamente o fim
        tasks.save(make_task(3, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{31, 7, 2026}), kOwner);  // um dia antes
        tasks.save(make_task(4, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{1, 9, 2026}), kOwner);   // um dia depois

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 8, 2026}, domain::Date{31, 8, 2026}));

        VP_EXPECT(summary.tasks_total == 2,
                  "as duas pontas entram e os vizinhos de fora nao");
    }

    // --- Periodo de um unico dia e periodo invertido ------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;
        tasks.save(make_task(1, domain::Category::Health, domain::TaskStatus::Executed,
                             domain::Date{10, 8, 2026}), kOwner);

        reporting::ReportingService service{goals, tasks};

        const auto single_day = service.execute(
            window(domain::Date{10, 8, 2026}, domain::Date{10, 8, 2026}));
        VP_EXPECT(single_day.tasks_total == 1, "um periodo de um dia so e valido");

        bool inverted_rejected = false;

        try
        {
            static_cast<void>(service.execute(
                window(domain::Date{11, 8, 2026}, domain::Date{10, 8, 2026})));
        }
        catch (const std::invalid_argument&)
        {
            inverted_rejected = true;
        }

        VP_EXPECT(inverted_rejected, "um periodo invertido deve ser rejeitado");
    }

    // --- Pesos, denominador e as contagens brutas ---------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        const domain::Date day{10, 8, 2026};

        // 1 concluida + 1 parcial + 1 falhada = (1,0 + 0,5 + 0,0) / 3 = 0,5
        goals.save(make_goal(domain::Category::Study, domain::GoalStatus::Completed, day), kOwner);
        goals.save(make_goal(domain::Category::Study, domain::GoalStatus::PartiallyCompleted, day), kOwner);
        goals.save(make_goal(domain::Category::Work, domain::GoalStatus::Failed, day), kOwner);

        // 1 executada + 1 parcial + 1 cancelada + 1 adiada
        //   = (1,0 + 0,5 + 0,0 + 0,0) / 4 = 0,375
        tasks.save(make_task(1, domain::Category::Study, domain::TaskStatus::Executed, day), kOwner);
        tasks.save(make_task(2, domain::Category::Study, domain::TaskStatus::PartiallyExecuted, day), kOwner);
        tasks.save(make_task(3, domain::Category::Work, domain::TaskStatus::Cancelled, day), kOwner);
        tasks.save(make_task(4, domain::Category::Work, domain::TaskStatus::Postponed, day), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(window(day, day));

        VP_EXPECT(summary.goals_total == 3, "o denominador de metas inclui a falhada");
        VP_EXPECT(summary.goals_completed == 1, "a contagem bruta de concluidas deve ser exposta");
        VP_EXPECT(summary.goals_partially_completed == 1,
                  "a contagem bruta de parciais deve ser exposta separada");
        VP_EXPECT(summary.goals_ratio.has_value() && *summary.goals_ratio == 0.5,
                  "o status parcial vale meio na razao de metas");

        // O ponto do incentivo perverso: cancelar e adiar CONTINUAM no
        // denominador. Se saissem, a razao seria 0,75 em vez de 0,375.
        VP_EXPECT(summary.tasks_total == 4,
                  "o denominador de tarefas inclui canceladas e adiadas");
        VP_EXPECT(summary.tasks_executed == 1, "a contagem bruta de executadas deve ser exposta");
        VP_EXPECT(summary.tasks_partially_executed == 1,
                  "a contagem bruta de parciais deve ser exposta separada");
        VP_EXPECT(summary.tasks_ratio.has_value() && *summary.tasks_ratio == 0.375,
                  "canceladas e adiadas no denominador dao 1,5/4 = 0,375");

        VP_EXPECT(summary.productivity_index.has_value() &&
                      *summary.productivity_index == 0.5 * 0.5 + 0.5 * 0.375,
                  "o indicador geral e a media de metas e tarefas");

        // Categorias: completas, nao esparsas — Work aparece com score zero.
        VP_EXPECT(summary.task_categories.size() == 2,
                  "as duas categorias presentes devem aparecer");
        VP_EXPECT(summary.task_categories.front().label == "Study",
                  "as categorias saem por score decrescente");
        const auto* work = find_bucket(summary.task_categories, "Work");
        VP_EXPECT(work != nullptr && work->score == 0.0 && work->total == 2,
                  "uma categoria sem nada realizado ainda aparece, com score zero");
        VP_EXPECT(!has_label(summary.task_categories, "Leisure"),
                  "categoria sem nenhum item no periodo nao deve aparecer");
    }

    // --- Tudo cancelado: razao ZERO, e nao nula -----------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;
        const domain::Date day{10, 8, 2026};

        tasks.save(make_task(1, domain::Category::Work, domain::TaskStatus::Cancelled, day), kOwner);
        tasks.save(make_task(2, domain::Category::Work, domain::TaskStatus::Cancelled, day), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(window(day, day));

        // A distincao que o contrato faz questao: null e "nao ha o que medir";
        // 0,0 e "havia o que medir e nao foi feito".
        VP_EXPECT(summary.tasks_ratio.has_value() && *summary.tasks_ratio == 0.0,
                  "tudo cancelado da razao zero, nao nula");
        VP_EXPECT(summary.most_productive_weeks.empty(),
                  "sem nada executado nao ha semana produtiva");
        VP_EXPECT(summary.most_productive_shifts.empty(),
                  "sem nada executado nao ha turno produtivo");
        VP_EXPECT(summary.productivity_index.has_value() && *summary.productivity_index == 0.0,
                  "so tarefas, todas canceladas, dao indicador zero");
    }

    // --- Indicador quando so um dos dois existe -----------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;
        const domain::Date day{10, 8, 2026};

        goals.save(make_goal(domain::Category::Study, domain::GoalStatus::Completed, day), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(window(day, day));

        VP_EXPECT(!summary.tasks_ratio.has_value(), "nao ha tarefa no periodo");
        VP_EXPECT(summary.productivity_index.has_value() && *summary.productivity_index == 1.0,
                  "com so um lado presente o indicador usa esse lado sozinho");
    }

    // --- Semanas, meses e empate --------------------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        // Semana de 03/08/2026 (segunda) e semana de 10/08/2026 (segunda),
        // uma executada em cada: empate.
        tasks.save(make_task(1, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{5, 8, 2026}), kOwner);
        tasks.save(make_task(2, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{12, 8, 2026}), kOwner);
        // Uma terceira semana com nada executado.
        tasks.save(make_task(3, domain::Category::Work, domain::TaskStatus::Cancelled,
                             domain::Date{19, 8, 2026}), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 8, 2026}, domain::Date{31, 8, 2026}));

        VP_EXPECT(summary.most_productive_weeks.size() == 2,
                  "empate deve devolver todas as semanas empatadas");
        // Rotulos fixados contra o valor ISO real (conferido com
        // datetime.date.isocalendar): 05/08/2026 e W32 e 12/08/2026 e W33.
        // Sem isto, um erro de uma semana no calculo passaria despercebido,
        // porque os outros testes so comparam os baldes entre si.
        VP_EXPECT(summary.most_productive_weeks[0].label == "2026-W32",
                  "05/08/2026 pertence a semana ISO 32 de 2026");
        VP_EXPECT(summary.most_productive_weeks[1].label == "2026-W33",
                  "12/08/2026 pertence a semana ISO 33 de 2026");
        VP_EXPECT(summary.most_productive_weeks[0].score == 1.0,
                  "o score da semana e a soma dos pesos");

        // Um unico mes tem execucao, entao ele e o unico mais produtivo.
        VP_EXPECT(summary.most_productive_months.size() == 1,
                  "so ha um mes com execucao no periodo");
        VP_EXPECT(summary.most_productive_months[0].label == "2026-08",
                  "o rotulo do mes e YYYY-MM");
        VP_EXPECT(summary.most_productive_months[0].total == 3,
                  "o total do mes conta tambem a cancelada");
        VP_EXPECT(summary.most_productive_months[0].score == 2.0,
                  "o score do mes soma so o que foi executado");
    }

    // --- Semana ISO na virada de ano ----------------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        // 31/12/2026 e uma quinta-feira: pela regra ISO ela pertence a semana 53
        // de 2026. Ja 01/01/2027 e sexta, da MESMA semana ISO.
        tasks.save(make_task(1, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{31, 12, 2026}), kOwner);
        tasks.save(make_task(2, domain::Category::Work, domain::TaskStatus::Executed,
                             domain::Date{1, 1, 2027}), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 12, 2026}, domain::Date{31, 1, 2027}));

        VP_EXPECT(summary.most_productive_weeks.size() == 1,
                  "dias de anos civis diferentes na mesma semana ISO caem num balde so");
        // O ano do rotulo e o da quinta-feira da semana, nao o do dia: por isso
        // 01/01/2027 aparece como 2026-W53.
        VP_EXPECT(summary.most_productive_weeks[0].label == "2026-W53",
                  "31/12/2026 e 01/01/2027 estao ambos na semana ISO 53 de 2026");
        VP_EXPECT(summary.most_productive_weeks[0].total == 2,
                  "os dois dias devem estar no mesmo balde de semana");
        VP_EXPECT(summary.most_productive_months.size() == 2,
                  "por mes eles se separam, porque mes nao e semana ISO");
    }

    // --- Fevereiro bissexto --------------------------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        tasks.save(make_task(1, domain::Category::Health, domain::TaskStatus::Executed,
                             domain::Date{29, 2, 2024}), kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 2, 2024}, domain::Date{29, 2, 2024}));

        VP_EXPECT(summary.tasks_total == 1, "29/02 de ano bissexto deve entrar no periodo");
        VP_EXPECT(summary.most_productive_months[0].label == "2024-02",
                  "o mes de fevereiro bissexto e rotulado normalmente");
    }

    // --- Turnos mais produtivos ---------------------------------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;
        const domain::Date day{10, 8, 2026};

        tasks.save(make_task(1, domain::Category::Work, domain::TaskStatus::Executed, day,
                             std::chrono::hours{8}), kOwner);   // Morning
        tasks.save(make_task(2, domain::Category::Work, domain::TaskStatus::Executed, day,
                             std::chrono::hours{14}), kOwner);  // Afternoon
        tasks.save(make_task(3, domain::Category::Work, domain::TaskStatus::Executed, day,
                             std::chrono::hours{15}), kOwner);  // Afternoon
        tasks.save(make_task(4, domain::Category::Work, domain::TaskStatus::Cancelled, day,
                             std::chrono::hours{20}), kOwner);  // Evening, sem execucao

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(window(day, day));

        VP_EXPECT(summary.most_productive_shifts.size() == 1,
                  "Afternoon tem o maior score sozinho");
        VP_EXPECT(summary.most_productive_shifts[0].label == "Afternoon",
                  "o turno mais produtivo deve ser Afternoon");
        VP_EXPECT(summary.most_productive_shifts[0].score == 2.0,
                  "Afternoon soma as duas executadas");
    }

    // --- Goal semanal conta uma vez, nao uma por semana ---------------------
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        goals.save(domain::Goal{0, "meta semanal", domain::Category::Study,
                                domain::GoalStatus::Completed, domain::GoalPeriod::Weekly,
                                domain::Date{10, 8, 2026}}, kOwner);

        reporting::ReportingService service{goals, tasks};
        const auto summary = service.execute(
            window(domain::Date{1, 1, 2026}, domain::Date{31, 12, 2026}));

        VP_EXPECT(summary.goals_total == 1,
                  "uma Goal Weekly conta uma vez no ano, nao uma por semana");
    }

    // --- Escopo por dono (issue #113) --------------------------------------
    //
    // O relatorio e sempre de alguem. Com dados de duas pessoas na mesma base,
    // cada uma so pode enxergar os proprios numeros — inclusive o indicador
    // geral, que nao pode herdar a media de quem tem dado.
    {
        persistence::InMemoryGoalRepository goals;
        persistence::InMemoryTaskRepository tasks;

        const domain::Date day{5, 8, 2026};

        goals.save(make_goal(domain::Category::Study,
                             domain::GoalStatus::Completed, day), kOwner);
        tasks.save(make_task(1, domain::Category::Study,
                             domain::TaskStatus::Executed, day), kOwner);

        reporting::ReportingService service{goals, tasks};

        const auto owner_summary = service.execute(window(day, day));

        VP_EXPECT(owner_summary.goals_total == 1,
                  "o dono ve a propria meta");
        VP_EXPECT(owner_summary.tasks_total == 1,
                  "o dono ve a propria tarefa");

        const auto other_summary = service.execute(
            reporting::ReportRequest{day, day, kOtherUser});

        VP_EXPECT(other_summary.goals_total == 0,
                  "a meta de outra pessoa nao entra na contagem");
        VP_EXPECT(other_summary.tasks_total == 0,
                  "a tarefa de outra pessoa nao entra na contagem");
        VP_EXPECT(!other_summary.goals_ratio.has_value(),
                  "sem dado proprio a razao e nula, e nao a do vizinho");
        VP_EXPECT(!other_summary.productivity_index.has_value(),
                  "o indicador geral nao pode herdar a media de quem tem dado");
        VP_EXPECT(other_summary.most_productive_weeks.empty(),
                  "nenhum balde de outra pessoa aparece no ranking");
    }

    return 0;
}
