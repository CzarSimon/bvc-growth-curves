import type { NextConfig } from "next";
import { INVITE_PATH } from "./src/lib/invite-path";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /*
         * The invite pages carry the token in the URL path, which is the one
         * place a secret is hard to keep quiet. Neither header defends against
         * guessing the token — 128 bits does that — they close the two ways a
         * real one gets away from its owner.
         *
         * `no-referrer`: any link or third-party asset ever added to this page
         * would otherwise put the whole URL, token included, in the Referer
         * header of the request that follows.
         *
         * `noindex`: a link pasted somewhere public should not end up in a
         * search index. Crawling one is harmless in itself — accepting an
         * invite takes an authenticated POST, so a bot cannot consume it — but
         * an indexed invite is an invite anyone can find.
         */
        source: `${INVITE_PATH}/:token*`,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
