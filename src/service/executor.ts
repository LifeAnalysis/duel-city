import { Container } from "@/container";

import handleSocketMessage from "./onSocketMessage";

export async function pollSocketLooper(container: Container) {
  await container.conn.execute((event) =>
    handleSocketMessage(container, event),
  );
}
