import { handleMediaRequest } from "@komikhq/media-core";

export default {
  fetch(request, env) {
    return handleMediaRequest(request, env.MEDIA_BUCKET);
  },
} satisfies ExportedHandler<Env>;
