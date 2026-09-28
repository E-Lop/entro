/**
 * Valori che imitano ciò che non deve mai uscire dalla suite (#187): un JWT, un
 * URL firmato col suo token, un'email. Finti, ma della forma giusta, perché il
 * test sull'output li cerca per forma oltre che per valore.
 */
export const LEAKY_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0cmFwZWxhIn0.ZmlydGFGaW50YQ'
export const LEAKY_SIGNED_URL = `http://127.0.0.1:54321/storage/v1/object/sign/food-images/x.jpg?token=${LEAKY_JWT}`
export const LEAKY_EMAIL = 'trapela-sentinella@example.test'
