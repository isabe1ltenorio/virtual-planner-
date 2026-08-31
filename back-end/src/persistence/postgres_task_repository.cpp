#include "virtual_planner/infrastructure/postgres/postgres_task_repository.hpp"
#include <pqxx/pqxx>

namespace virtual_planner::infrastructure::postgres {

PostgresTaskRepository::PostgresTaskRepository(std::shared_ptr<PostgresDatabase> database)
    : database_(std::move(database)) {}

domain::Task PostgresTaskRepository::save(const domain::Task& task, int user_id) {
    auto conn = database_->get_connection();
    pqxx::work txn(*conn);

    // O enum precisa ser convertido para string na hora de salvar, e vice-versa.
    std::string date_str = std::to_string(task.date().year()) + "-" + 
                           std::to_string(task.date().month()) + "-" + 
                           std::to_string(task.date().day());

    if (task.id() == 0) {
        pqxx::row row = txn.exec_params1(
            "INSERT INTO tasks (user_id, description, category, task_date, start_minutes, end_minutes, priority, status) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
            user_id, task.description(), /* converter enum category para string */ "Study", 
            date_str, 
            task.time_slot().has_value() ? std::optional<int>(task.time_slot()->start()) : std::nullopt,
            task.time_slot().has_value() ? std::optional<int>(task.time_slot()->end()) : std::nullopt,
            /* converter enum priority */ "Medium", 
            /* converter enum status */ "Pending"
        );
        txn.commit();
        
        // Retornar a task com o novo ID preenchido
        return task; // (Simplificado: Na prática você usaria um construtor/builder da entidade retornando row[0].as<int>())
    } else {
        txn.exec_params(
            "UPDATE tasks SET description = $1, category = $2, task_date = $3, start_minutes = $4, end_minutes = $5, priority = $6, status = $7 "
            "WHERE id = $8 AND user_id = $9",
            task.description(), "Study", date_str, 
            task.time_slot().has_value() ? std::optional<int>(task.time_slot()->start()) : std::nullopt,
            task.time_slot().has_value() ? std::optional<int>(task.time_slot()->end()) : std::nullopt,
            "Medium", "Pending", task.id(), user_id
        );
        txn.commit();
        return task;
    }
}

// (As implementações de find_by_id, find_by_date e delete_by_id seguem a mesma lógica do pqxx::work, filtrando sempre por user_id)

} // namespace virtual_planner::infrastructure::postgres