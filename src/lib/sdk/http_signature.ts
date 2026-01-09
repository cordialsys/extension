import { Login } from "@/lib/login";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";

export async function sign(
  name: "iam" | "pro" | "sso",
  login: Login,
  request: Request,
  treasuryId: string,
): Promise<Request> {
  const url = new URL(request.url);
  const method: string = request.method;
  const headers = request.headers;
  const body = await request.text();
  const path: string = url.pathname;
  const query = "";
  const contentDigest = base64.encode(sha256(utf8ToBytes(body ?? "")));

  const alg = "open-pubkey";
  const created = 123;
  const keyid = login.certificate;
  const nonce = (Math.random() * 10 ** 9) | 0;
  const tag = "";
  const params = `alg="${alg}";created=${created};keyid="${keyid}";nonce="${nonce}";tag="${tag}"`;
  const signatureParams = `("@method" "@path" "@query" "content-digest" "treasury");${params}`;

  const contentDigestHeader = `sha-256=:${contentDigest}:`;

  const signatureBase = `"@method": ${method}
"@path": ${path}
"@query": ${query}
content-digest: ${contentDigestHeader}:
treasury: ${treasuryId}
"@signature-params": ${signatureParams}
`;

  const signatureBytes = await crypto.subtle.sign(
    { name: "Ed25519" },
    login.identity.privateKey,
    new TextEncoder().encode(signatureBase),
  );
  const signature = base64.encode(new Uint8Array(signatureBytes));

  const signatureHeader = `${name}=:${signature}:`;
  const signatureInputHeader = `${name}=${signatureParams}`;

  headers.append("Content-Digest", contentDigestHeader);
  headers.append("Signature-Input", signatureInputHeader);
  headers.append("Signature", signatureHeader);
  headers.append("Treasury", treasuryId);
  headers.append("User", "36wmfPUiYuoh6E4yCb9lEdijCj0");
  console.log("headers", headers);
  for (const [h, v] of headers) {
    console.log(h, ":", v);
  }

  const signed = new Request(url, {
    method,
    headers,
    body,
  });
  console.log("signed request:", signed);
  return signed;
}
