const A = ['amber', 'cobalt', 'silent', 'rapid', 'lunar', 'neon', 'binary', 'static'];
const B = ['falcon', 'cipher', 'vector', 'orbit', 'signal', 'kernel', 'photon', 'packet'];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const makeSlug = () => `${pick(A)}-${pick(B)}-${Math.floor(1000 + Math.random() * 9000)}`;