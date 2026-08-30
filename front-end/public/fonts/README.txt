Coloque aqui os arquivos da fonte Gilroy, em .woff2:

  Gilroy-Regular.woff2   (peso 400)
  Gilroy-Medium.woff2    (peso 500)
  Gilroy-SemiBold.woff2  (peso 600)
  Gilroy-Bold.woff2      (peso 700)

O @font-face está declarado em src/index.css. Sem estes arquivos, a
interface cai no fallback (Plus Jakarta Sans / Inter / system-ui) sem quebrar.
