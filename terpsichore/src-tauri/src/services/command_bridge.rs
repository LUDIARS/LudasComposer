use crate::models::command::{CommandRequest, CommandResult, GameStatus};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

type CommandHandler = Box<dyn Fn(CommandRequest) -> CommandResult + Send + Sync>;
type GameStatusHandler = Box<dyn Fn() -> GameStatus + Send + Sync>;

pub struct CommandBridge {
    command_queue: Arc<Mutex<VecDeque<CommandRequest>>>,
    result_queue: Arc<Mutex<VecDeque<CommandResult>>>,
    command_handler: Arc<Mutex<Option<CommandHandler>>>,
    game_status_handler: Arc<Mutex<Option<GameStatusHandler>>>,
}

impl CommandBridge {
    pub fn new() -> Self {
        Self {
            command_queue: Arc::new(Mutex::new(VecDeque::new())),
            result_queue: Arc::new(Mutex::new(VecDeque::new())),
            command_handler: Arc::new(Mutex::new(None)),
            game_status_handler: Arc::new(Mutex::new(None)),
        }
    }

    pub fn enqueue_command(&self, request: CommandRequest) {
        let mut queue = self.command_queue.lock().unwrap();
        queue.push_back(request);
    }

    pub fn dequeue_command(&self) -> Option<CommandRequest> {
        let mut queue = self.command_queue.lock().unwrap();
        queue.pop_front()
    }

    pub fn enqueue_result(&self, result: CommandResult) {
        let mut queue = self.result_queue.lock().unwrap();
        queue.push_back(result);
    }

    pub fn dequeue_result(&self) -> Option<CommandResult> {
        let mut queue = self.result_queue.lock().unwrap();
        queue.pop_front()
    }

    pub fn set_command_handler<F>(&self, handler: F)
    where
        F: Fn(CommandRequest) -> CommandResult + Send + Sync + 'static,
    {
        let mut h = self.command_handler.lock().unwrap();
        *h = Some(Box::new(handler));
    }

    pub fn set_game_status_handler<F>(&self, handler: F)
    where
        F: Fn() -> GameStatus + Send + Sync + 'static,
    {
        let mut h = self.game_status_handler.lock().unwrap();
        *h = Some(Box::new(handler));
    }

    pub fn execute_command(&self, request: CommandRequest) -> CommandResult {
        let handler = self.command_handler.lock().unwrap();
        match handler.as_ref() {
            Some(h) => h(request),
            None => {
                self.enqueue_command(request);
                CommandResult::ok("Command queued for processing")
            }
        }
    }

    pub fn get_game_status(&self) -> GameStatus {
        let handler = self.game_status_handler.lock().unwrap();
        match handler.as_ref() {
            Some(h) => h(),
            None => GameStatus {
                playing: false,
                scene: None,
                custom_data: None,
            },
        }
    }

    pub fn pending_commands(&self) -> usize {
        self.command_queue.lock().unwrap().len()
    }

    pub fn pending_results(&self) -> usize {
        self.result_queue.lock().unwrap().len()
    }

    pub fn process_pending(&self) {
        loop {
            let cmd = self.dequeue_command();
            match cmd {
                Some(request) => {
                    let result = {
                        let handler = self.command_handler.lock().unwrap();
                        match handler.as_ref() {
                            Some(h) => h(request),
                            None => CommandResult::error("No handler registered"),
                        }
                    };
                    self.enqueue_result(result);
                }
                None => break,
            }
        }
    }
}

impl Default for CommandBridge {
    fn default() -> Self {
        Self::new()
    }
}
