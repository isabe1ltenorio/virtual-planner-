#pragma once

namespace virtual_planner::persistence
{

  enum class DatabaseState
  {
    NotStarted,
    Started,
    Connected,
    Stopped,
    Failed,
  };

  class Database
  {
  public:
    virtual ~Database() = default;

    void initialize();
    void connect();
    void shutdown();

    [[nodiscard]] DatabaseState state() const noexcept;
    [[nodiscard]] virtual bool is_connected() const noexcept;

  protected:
    virtual void on_initialize();
    virtual void on_connect();
    virtual void on_shutdown();

  private:
    DatabaseState state_{DatabaseState::NotStarted};
  };

}
