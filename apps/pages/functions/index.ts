import { handleMediaRequest } from "@komikhq/media-core";

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleMediaRequest(request, env.MEDIA_BUCKET);
