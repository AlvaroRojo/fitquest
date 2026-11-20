# FitQuest

Juego incremental de ejercicio en casa. Abre `index.html` en un navegador
moderno; no necesita instalación ni conexión. La partida se guarda en el
almacenamiento local del navegador y no se sincroniza entre dispositivos,
navegadores o ubicaciones del archivo. Borrar los datos del navegador puede
eliminarla.

## Cómo jugar

- **Misiones y monstruos:** registra solo el ejercicio que hayas realizado.
  Hay tres misiones activas, puedes cambiar cualquiera perdiendo su progreso,
  y se pueden completar hasta seis al día. Los objetivos se fijan al comenzar
  cada misión; descansar y adaptar el ejercicio siempre es más importante
  que una recompensa. Los objetivos no son recomendaciones médicas.
- **Personaje y tienda:** compra equipo con monedas del juego y equípalo. Los
  objetos comprados y los obtenidos en sobres comparten inventario. Pulsa un
  hueco equipado para vaciarlo.
- **Logros:** desbloquean mejoras permanentes al alcanzar sus objetivos. Las
  misiones se cuentan desde esta versión; los niveles y monstruos derrotados
  de partidas antiguas sí se reconocen.
- **Sobres:** cuestan 100 monedas virtuales, nunca dinero real. Obtienes un
  objeto: común 60 %, poco común 25 %, raro 12 % o legendario 3 %. Dentro de
  cada categoría todos los objetos tienen la misma probabilidad. Los
  duplicados devuelven 25 monedas; los objetos de sobres se pueden equipar
  aunque todavía no se haya alcanzado el nivel exigido en la tienda.
- **Autobatalla:** si está activa, el héroe causa 2 de daño cada 10 segundos,
  multiplicado por los bonos de daño de equipo y logros. Al volver se aplican
  como máximo ocho horas desde la última actualización; el resto se pierde.
  Pausarla evita todo progreso mientras está pausada. Los monstruos y sus
  recompensas son los mismos que en la sección de misiones.

Los bonos de cada estadística se suman entre sí. Las misiones, el equipo y las
recompensas son mecánicas de juego, no un plan de entrenamiento: adapta cada
actividad a tu capacidad y detente si sientes dolor.

## Referencias de diseño

El seguimiento de hábitos con niveles y equipo toma como inspiración general
[Habitica](https://github.com/HabitRPG/habitica); la progresión incremental,
[Gooboo](https://github.com/Tendsty/gooboo). FitQuest tiene implementación y
contenido propios.

## Desarrollo

Para ejecutar las pruebas de las mecánicas con Node.js: `node --test tests/game.test.js`.
