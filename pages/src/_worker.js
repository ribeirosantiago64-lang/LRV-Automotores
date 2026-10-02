// Same-origin proxy keeps admin cookies and CSRF protection on the Pages site.
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path.startsWith("/api/") || path.startsWith("/media/")) {
      if(!env.BACKEND)return new Response("El backend todavía no está conectado.",{status:503});
      return env.BACKEND.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
