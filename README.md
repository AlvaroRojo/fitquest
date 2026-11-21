# FitQuest

Juego incremental de ejercicio en casa. Abre `index.html` en un navegador
moderno; no necesita instalación ni conexión. La partida se guarda en el
almacenamiento local del navegador y no se sincroniza entre dispositivos,
navegadores o ubicaciones del archivo. Borrar los datos del navegador puede
eliminarla. Usa **Exportar partida** para guardar una copia JSON y **Importar
partida** para restaurarla; importar reemplaza la partida actual tras pedir
confirmación. Se aceptan las copias exportadas por esta versión.

## Cómo jugar

- **Navegación:** utiliza el menú superior para cambiar de sección. También
  puedes usar las flechas, Inicio y Fin del teclado entre las pestañas.
  En ordenador, la cabecera y el menú mantienen el mismo tamaño en todas ellas.
  La cabecera ilumina las ganancias y celebra las subidas de nivel; sus efectos
  respetan la preferencia del sistema de reducir movimiento.
- **Misiones y monstruos:** pulsa **Completado** solo después de realizar el
  objetivo indicado. Hay seis misiones activas: dos suaves, dos intermedias y
  dos intensas. Al completar una aparece otra aleatoria del mismo nivel.
  Frente al mismo ejercicio suave, las intermedias piden un 25 % más y las
  intensas un 50 % más (redondeado hacia arriba). La XP, el daño y las
  monedas de misión reciben además un multiplicador de dificultad: ×1 en
  suave, ×1,25 en intermedia y ×1,5 en intensa. Así, para un mismo ejercicio,
  el objetivo mayor también aumenta la XP y el daño antes de ese multiplicador.
  Las recompensas de ejercicios diferentes pueden variar según su cantidad y
  valor. Son categorías de juego, no una valoración
  médica: ejercicios distintos pueden tener dificultades reales diferentes.
  Las misiones antiguas mantienen su categoría hasta completarse.
  Se pueden completar sin límite al día. Hay 20 tipos de ejercicios y el
  objetivo se fija al comenzar cada misión y no cambia al cambiar el tormento;
  descansar y adaptar el ejercicio siempre es más importante
  que una recompensa. Los objetivos no son recomendaciones médicas. Si una
  partida anterior tenía progreso parcial, termina la parte restante antes
  de confirmar; únicamente se recompensará la parte que faltaba.
  El tormento multiplica su XP y monedas sin aumentar el objetivo del ejercicio.
  Los objetivos antiguos se ajustan una vez, conservando el progreso registrado.
  Adapta siempre el ejercicio a tu capacidad, independientemente del objetivo.
  El tablón muestra una estimación del daño, XP y oro (G) de cada encargo.
  El daño incluye los bonos de equipo, atributos, logros y racha; la
  estimación no incluye el botín de monstruos ni los logros nuevos.
  Las primeras seis misiones del día dan la recompensa completa; las
  posteriores dan el 25 % de XP, daño y monedas de misión. El botín de
  monstruos no se reduce. La primera misión del día da una llave de torre.
  Esto evita que acumular ejercicio sea necesario para progresar.
  El tablón usa los ejercicios y objetivos guardados en la partida, pero no
  muestra controles para personalizarlos ni para registrar descansos. Las
  preferencias y descansos anteriores se conservan al actualizar.
- **Encuentros de misiones:** cada enemigo tiene vida según su especie.
  Tras cada cinco victorias aparece un élite y, tras cada diez, un jefe
  en su lugar. En los demás encuentros hay un 5 % de probabilidad de
  encontrar un goblin de la suerte y otro 5 % de una criatura astral;
  son encuentros aleatorios, no eventos de tiempo limitado. Los élites dan
  el doble de monedas y XP y 2 fragmentos; los jefes dan el cuádruple y 5.
  El goblin da 5 veces las monedas, 1,5 veces la XP y 3 fragmentos; la
  criatura astral da el doble de monedas, el triple de XP y 4 fragmentos.
  El equipo y los logros también mejoran monedas y XP. El encuentro y su
  vida restante se guardan al cerrar; al actualizar se conserva la vida
  del enemigo anterior. Cada criatura se muestra de cuerpo completo en un
  bioma acorde, y los jefes cuentan con llamas animadas. Las animaciones
  respetan la preferencia del sistema de reducir movimiento. Estos encuentros
  son independientes de la arena.
- **Tienda:** cada día local, al abrir el juego o volver a él, se generan
  diez ofertas únicas según el nivel actual; al cambiar de tormento cambian las
  ofertas, manteniendo las compras y un máximo de diez compras al día. Cada
  selección de tormento conserva sus ofertas hasta medianoche, salvo ajustes
  para evitar duplicados con las compras. La rareza se sortea para
  cada objeto con pesos base 60/25/11/3/0,8/0,18/0,02
  (común/poco común/raro/legendario/mítico/ancestral/divino), modificados
  por el tormento al generar las ofertas;
  se excluyen las rarezas aún no desbloqueadas y se redistribuyen sus pesos.
  Cuando se agotan los objetos de una rareza también se excluye esa rareza.
  Dentro de la rareza sorteada se priorizan objetos no poseídos. Una oferta
  comprada se añade al inventario sin equiparse, incluso si ya posees otra
  copia, y no se puede volver a comprar ese día, aunque desmanteles el objeto.
  Al actualizar una partida, las ocho ofertas existentes se conservan y se
  añaden dos más del nivel con el que se generaron.
  La **forja permanente** permite comprar hasta diez mejoras en total cada semana natural
  (de lunes a domingo, hora local): Filo eterno, Sabiduría arcana o Prosperidad
  dorada. Cada rango añade un punto porcentual al bono de daño, XP o monedas
  del equipo, respectivamente, solo mientras lleves al menos un objeto de esa
  estadística. El coste aumenta en 100 monedas tras cada compra, empezando en
  150; se calcula con la suma de todos los rangos de la forja y no se reinicia
  cada semana. Una compra hecha antes de actualizar cuenta para esa semana.
  Los rangos se conservan al cambiar o desmantelar objetos y se suman a los
  demás bonos. El contador de compras semanales aparece separado de las mejoras
  para que no se solape con ellas. El equipo y la forja usan monedas del juego,
  no dinero real.
- **Personaje y equipo:** compra equipo con monedas del juego y equípalo. Los
  objetos comprados y los obtenidos en sobres comparten inventario. En la
  pestaña de personaje pulsa Equipar para colocarlo automáticamente en un hueco
  compatible. Se usa el primer hueco libre o, si están ocupados, se sustituye
  el primero; el objeto anterior permanece en el inventario. También puedes
  arrastrar un objeto a un hueco concreto o pulsar un hueco equipado para
  vaciarlo. La joyería se muestra por separado. El marcador de poder suma el
  nivel del personaje, los porcentajes totales de daño, XP y monedas (equipo,
  mejoras de objetos, atributos, forja y logros), el efecto multiplicativo de
  prestigio y los rangos de mejoras de arena. Es un indicador visual y no añade
  bonificaciones de combate. El héroe
  tiene 500 evoluciones visuales: la primera comienza en 1 de poder y se
  alcanza una nueva cada 10 puntos, hasta la última en 4991. El aspecto puede
  retroceder si disminuye el poder. El inventario muestra solo los objetos
  sin equipar, ordenados de mayor a menor rareza. Sus fondos reflejan la rareza.
  Las copias del mismo objeto son independientes: cada una se puede equipar,
  mejorar o desmantelar por separado.
  Desmantela objetos no equipados con
  dos pulsaciones: dan 2, 5, 12, 25, 40, 65 o 100 fragmentos según su rareza. El inventario
  se puede filtrar por tipo y muestra hasta 12 objetos por página; al cambiar
  de página la vista baja hasta el final del inventario. Los objetos no
  equipados se desmantelan individualmente desde su propia tarjeta.
  En ordenador, personaje y entrenamiento se muestran arriba y el inventario
  ocupa el ancho completo debajo. En pantallas amplias, como 1680 × 1050,
  los textos y controles aumentan de tamaño.
  Desequipa un objeto para poder mejorarlo. Puedes usar fragmentos para mejorarlo
  sin un máximo de nivel; cada mejora añade un 1 %
  a su estadística. El coste es 5 + 3 por nivel de mejora actual + 2 por
  índice de rareza (común 0 a divino 6). Desmantelar elimina el objeto y sus
  mejoras. En la tienda puedes fabricar un objeto aleatorio del tipo y rareza
  elegidos. Las rarezas común, poco común, rara, legendaria, mítica, ancestral
  y divina requieren respectivamente los niveles 1, 10, 20, 40, 40, 60 y 60
  para fabricarse; cuestan 10, 30, 70, 400, 1200, 3000 y 8000 fragmentos.
  Desmantelar el resultado siempre devuelve menos de lo invertido. Estos niveles
  de fabricación son independientes de los desbloqueos de tienda y sobres;
  los objetos ya conseguidos se conservan.
  Hay 218 objetos en siete rarezas; los sobres ofrecen otra forma de
  conseguirlos.
- **Entrenamiento del héroe:** en la pestaña Personaje puedes comprar rangos
  sin límite de Poder, Sabiduría y Fortuna con monedas del juego. Cada rango
  añade un 1 % a daño, XP o monedas, respectivamente. El siguiente rango
  cuesta `100 + 50 × rango + 2 × rango × max(0, rango − 1)²` monedas.
  Los rangos existentes se conservan; el coste crece más en niveles avanzados
  para evitar que el oro y el daño se disparen sin control. Estos bonos se suman a los del
  equipo, forja y logros y se aplican también a la arena, la torre y los bosses. El panel
  de estadísticas muestra el bono efectivo, incluido el estilo activo.
  Bajo el entrenamiento se muestran los bonos efectivos, críticos, fragmentos,
  daño e intervalo de arena, daño base de desafíos y estilo activo. La pestaña
  **Estadísticas** organiza más de 60 datos guardados y derivados en paneles
  visuales de aventura, combate, héroe, equipo, economía, habilidades y logros.
- **Parangón y prestigio:** reúne los árboles de habilidades, pasivas
  ancestrales y prestigio. Desde el nivel 50 se puede prestigiar: se obtiene
  un punto por cada diez niveles completos alcanzados, acumulable entre
  prestigios. Antes del reinicio se aplica la autobatalla pendiente.
  Se reinician el nivel, XP, habilidades, pasivas, subclase, tormento y todo
  el equipo, equipado o no, incluidas sus mejoras. Los objetivos activos se
  ajustan al nivel 1 sin perder progreso ya registrado; se conserva el
  porcentaje de vida de los enemigos y desafíos al pasar a Normal. Se conservan
  la racha, recursos, logros, atributos, forja, mejoras de arena, misiones
  completadas, travesía y progreso de desafíos. Las compras de tienda del día
  siguen contando; sus nuevas ofertas usan el nivel 1. Es recomendable
  exportar una copia antes de prestigiar.
  El mapa tiene 300 nodos pequeños y 30 mejoras mayores en diez ramas: daño,
  XP, monedas, fragmentos, una rama universal, probabilidad y daño crítico,
  daño y botín de autobatalla y tiempo sin conexión. Los nodos se agrupan
  alrededor de las mejoras mayores. Cada nodo cuesta un punto: los originales
  mantienen sus requisitos; cada eco exige el nodo original correspondiente y
  cada mejora mayor exige el quinto o décimo nodo original de su rama.
  Cada rama tiene además una constelación de ascensión con mejoras que combinan
  dos efectos: su primer nodo exige la segunda mejora mayor anterior, sus
  siguientes nodos forman una cadena y su legado exige completar esa cadena.
  Entre ellas, Verdugo celeste combina daño crítico con un multiplicador
  exclusivo para los ataques de torre y bosses.
  Las mejoras de multiplicador se suman dentro del
  prestigio y se multiplican por los demás bonos; los críticos añaden puntos
  al porcentaje existente (la probabilidad sigue limitada al 75 %). Los nodos
  de vigilia añaden el tiempo indicado al límite sin conexión. El multiplicador de monedas
  también afecta a recompensas de travesía y logros; el de fragmentos no
  afecta al desmantelamiento. Redistribuir devuelve todos los puntos gratis.
  Pasa el ratón o enfoca un nodo para ver sus efectos y requisitos; un clic o
  la activación con teclado lo desbloquea. Su conexión se ilumina y las líneas
  punteadas identifican los ecos. Se puede desplazar el mapa
  arrastrándolo con el ratón, con el teclado o mediante gestos táctiles; las
  barras de desplazamiento están ocultas. La rueda del ratón acerca o aleja
  el mapa alrededor del cursor y los botones de zoom también funcionan en móvil.
  El alejamiento está limitado al 50 % o al mínimo necesario para llenar la
  ventana del mapa si esta es más grande.
- **Árbol de habilidades:** al llegar a cada nivel se obtiene un punto,
  incluidos los niveles existentes al actualizar; el nivel inicial también da
  uno. En los niveles múltiplos de diez se reciben dos puntos en total. Las
  cuatro ramas ofrecen daño, crítico, monedas, XP y fragmentos de recompensas.
  Los nodos normales admiten 20 rangos y requieren cinco puntos en el nodo
  anterior para desbloquearse. Los nodos ya desbloqueados en partidas antiguas
  mantienen sus rangos y pueden seguir mejorándose; al redistribuirlos se aplican
  los requisitos nuevos. Instinto letal permite llegar al 75 % de probabilidad crítica.
  También hay tres especializaciones de un punto: Berserker (+30 % daño,
  −20 % XP y monedas), Cazador (+15 puntos de crítico, +25 puntos de daño
  crítico, críticos que ignoran la resistencia de bosses y −15 % daño) y
  Buscatesoros (+20 % XP y monedas, 10 % de probabilidad de duplicar los
  fragmentos al derrotar un enemigo de misión y −20 % daño).
  Solo una puede estar activa; se puede cambiar entre las desbloqueadas o
  volver al estilo neutral. **Redistribuir puntos** los recupera todos gratis,
  previa confirmación, y restablece el estilo neutral.
  Los bonos de daño, monedas y XP se suman a los demás bonos; los de fragmentos
  afectan a enemigos, desafíos, logros y travesía, no al desmantelamiento. Los golpes
  críticos pueden producirse en misiones, arena, torre y bosses, tienen una
  probabilidad máxima del 75 % y causan inicialmente el 150 % del daño.
  Los críticos visibles muestran un impacto y su daño en misiones, arena,
  torre y bosses; el progreso acumulado sin conexión no reproduce golpes pasados.
- **Pasivas ancestrales:** se desbloquean al nivel 50 y dan un punto independiente
  por nivel a partir de ese nivel, también retroactivamente. Las cuatro ramas
  tienen veinte mejoras de hasta cinco rangos; para desbloquear la siguiente se
  necesitan tres rangos en la anterior. Sus bonos se suman a los de habilidades,
  equipo y logros, y el crítico conserva su límite del 75 %. Antes de invertir
  un punto que supere ese límite se muestra un aviso y se puede cancelar.
  Al alcanzar el rango 5 en el último nodo de cada rama se desbloquea una
  maestría: Guerra reduce un 25 % la resistencia de bosses; Caza reduce a la
  mitad la resistencia restante en golpes críticos; Fortuna añade un 10 % de
  probabilidad de duplicar fragmentos de enemigos de misión; Sabiduría amplía
  el progreso de arena sin conexión a 12 horas. Las reducciones de resistencia
  se combinan multiplicativamente; los críticos del Cazador siguen ignorándola
  por completo. Las probabilidades de Fortuna y Buscatesoros se suman.
  Con 20 puntos invertidos se elige una subclase sin coste adicional:
  Campeón (+30 % de daño), Asesino (+10 % de probabilidad y +30 % de daño
  crítico) u Oráculo (+20 % de XP, monedas y fragmentos de recompensas).
  Estas mejoras se suman a los demás bonos. Solo una puede estar activa;
  se puede cambiar gratuitamente entre subclases sin redistribuir los puntos.
  Redistribuir pasivas sigue siendo gratuito, elimina la subclase activa y no
  afecta al árbol de habilidades original. Las copias
  de seguridad antiguas siguen siendo compatibles.
- **Logros:** desbloquean mejoras permanentes al alcanzar sus objetivos. Las
  misiones se cuentan desde esta versión; los niveles y monstruos derrotados
  de partidas antiguas sí se reconocen. Hay nuevos hitos incrementales para
  arena, cacería de misiones, torre, bosses semanales, colección, forja,
  mejoras de arena, atributos y objetivos avanzados de misiones y sobres.
  El progreso existente se reconoce automáticamente al cargar la partida.
  Los antiguos logros de expediciones conservan su progreso y recompensas;
  desde esta versión avanzan con nuevas victorias de arena, torre y bosses.
  Sus recompensas de llaves ahora dan llaves de torre.
- **Sobres:** hay cuatro tipos, comprados únicamente con monedas del juego:
  aventurero (100, nivel 10), plata (300, nivel 20), dorado (800, nivel 40)
  y arcano (1800, nivel 60). Las siete rarezas se desbloquean en los niveles
  1, 5, 10, 15, 20, 30 y 40; solo pueden salir objetos disponibles al nivel
  actual. Cada sobre tiene distintos pesos y los más caros favorecen las
  rarezas altas. En Normal, con todas las rarezas disponibles, las
  probabilidades de común a divino son:
  aventurero 55/26/13/4,5/1,1/0,35/0,05 %;
  plata 40/30/20/7/2/0,8/0,2 %;
  dorado 22/27/30/14/5/1,7/0,3 %;
  arcano 10/20/30/22/11/5,5/1,5 %.
  Los pesos de rarezas bloqueadas se excluyen y los restantes
  se normalizan; el tormento favorece las rarezas altas y las probabilidades
  actuales se muestran antes de comprar. Tras 20 sobres consecutivos sin
  legendario o superior, el siguiente garantiza una de esas rarezas; la
  garantía es global para todos los sobres y se conserva entre sesiones.
  Se acumula también antes del nivel 15, pero se aplica únicamente cuando esa
  rareza está desbloqueada. La pantalla muestra el contador y las
  probabilidades efectivas, incluidas las de la garantía.
  Cada objeto de una rareza tiene igual probabilidad. Cada premio se añade al
  inventario, incluso si es repetido, sin devolución de monedas. También se
  pueden abrir diez sobres del mismo tipo por diez veces su precio: cada
  tirada se realiza por separado, actualiza la garantía antes de la siguiente y
  muestra sus diez premios en tarjetas animadas. Se necesita el importe
  completo antes de empezar. La compra se
  guarda inmediatamente, antes de mostrar el carrusel animado, cuyo recorrido
  y punto de parada cambian en cada apertura, y su destello de
  revelación según la rareza. El carrusel añade objetos de relleno a ambos lados
  para que no se vea su final. Las animaciones respetan la preferencia del sistema de
  reducir movimiento.
- **Autobatalla:** siempre está activa y recorre 16 tipos de monstruos.
  Los élites y jefes de la arena son únicamente visuales: su vida y botín
  siguen la misma progresión que los demás enemigos de arena.
  La vida base del enemigo `n` es `50 + 12 × n + 2 × n^1,7`, redondeada;
  crece más despacio que antes. La vida restante de partidas existentes se
  convierte proporcionalmente una sola vez. El ataque inicial causa 2 de daño cada 10 segundos, con los bonos generales
  de daño. Tres mejoras permanentes usan monedas del juego: daño (+1 al daño
  base por rango; coste `100 + 50 × rango + 2 × rango × max(0, rango − 1)²`), velocidad (-0,4 s por rango;
  coste 250 + 125 por rango, máximo 20 rangos y 2 s) y botín (+10 % a las
  monedas y XP de arena por rango; coste `200 + 100 × rango + 2 × rango × max(0, rango − 1)²`). Daño y botín
  no tienen límite. Antes de mejorar se calcula el combate pendiente con las
  mejoras anteriores; al cambiar la velocidad se conserva la fracción del
  ataque en curso. Al volver se aplican como máximo ocho horas desde la última
  actualización (doce con la maestría de Sabiduría); el resto se pierde. La arena tiene sus propios monstruos y
  victorias, independientes de las misiones. Sus enemigos reciben
  la vida y el botín del tormento activo. Las partidas anteriores
  conservan su progreso y empiezan con las mejoras de arena a cero.
- **Torre de 100 plantas:** la primera misión de cada día da una llave de
  torre. Las llaves de mazmorra acumuladas en partidas anteriores se convierten
  una sola vez en llaves de torre. Se pueden acumular y cada ataque
  consume una; solo se permite un ataque al día para toda la torre. La vida
  del enemigo se conserva entre días. Derrotarlo concede monedas, XP y
  fragmentos y abre la siguiente planta; el daño sobrante no se traslada.
  Cada ataque no letal concede adicionalmente hasta un 20 % del botín de
  victoria, proporcional al daño causado respecto a la vida máxima. Se redondea
  hacia abajo después de aplicar los bonos, incluidos los de fragmentos de
  habilidades, pasivas y subclase, y usa el tormento mínimo en el que se ha atacado.
  La planta 100 completa la torre. Se puede iniciar otra vuelta opcional tantas
  veces como se desee: cada vuelta adicional aumenta un 50 % la vida base y
  un 25 % las recompensas, conservando las llaves, el historial y el límite
  de un ataque por día. Desde la segunda vuelta, las plantas 25, 50, 75 y 100
  tienen guardianes con resistencias distintas; cada victoria da fragmentos y
  una Espada del guardián exclusiva, además del botín habitual. Las copias
  tienen los mismos atributos que una espada legendaria normal.
  El ataque causa 24 de daño base, con los bonos generales
  de daño.
- **Bosses semanales:** hay doce enemigos en orden. Se permiten hasta tres
  ataques por semana natural (lunes a domingo, hora local), con un
  máximo de uno al día; la vida se
  conserva entre semanas. Al derrotar al boss se reciben monedas, XP y
  fragmentos y se abre el siguiente. El ataque causa 40 de daño base con los
  bonos generales. Cada boss tiene una resistencia propia; algunas se activan
  según su vida o en ataques alternos. Los ataques no letales dan la misma
  recompensa proporcional de progreso que en la torre. Al vencer al último comienza otra vuelta
  con un 50 % más de vida base por vuelta y recompensas crecientes. Quienes ya
  habían vencido a los ocho bosses anteriores continúan desde el noveno.
- **Modos retirados:** las expediciones del vacío y las mazmorras por nivel
  dejan de estar disponibles. Los encuentros pendientes se interrumpen y no
  otorgan recompensas adicionales; sus datos permanecen en la partida.
- **Tormento global:** en la pestaña **Tormento**, todos los rangos están
  visibles para comparar sus efectos y seleccionar uno disponible. El santuario muestra
  la dificultad activa; los rangos bloqueados indican el nivel necesario.
  Hay Normal y doce rangos,
  desbloqueados cada diez niveles desde el 10 hasta el 120. Los rangos I a XII
  multiplican la vida enemiga por 1,75/2,5/4/6/8/11/15/21/30/42/60/85 y
  las monedas, XP y fragmentos de misiones, capítulos y logros por
  1,4/1,8/2,5/3,5/4,5/5,5/7/9/11,5/14,5/18/22,5. El botín de enemigos,
  torre y bosses utiliza otro multiplicador: `vida × (1 + 0,02 × rango)`,
  para mejorar la recompensa por vida derrotada al subir el tormento.
  El objetivo del ejercicio no aumenta con el tormento. Los sobres y la
  selección diaria de la tienda favorecen más las rarezas altas:
  el peso de cada rareza se multiplica por `(1 + 0,02 × rango) ^ índice`,
  excluyendo las rarezas bloqueadas por nivel y normalizando después.
  Las monedas y fragmentos de logros y capítulos también aumentan; las llaves,
  los objetos y los porcentajes
  permanentes de logros no cambian. Las recompensas de capítulo se calculan
  con el tormento de la misión que lo completa.
  El cambio se aplica inmediatamente a las misiones, los enemigos de misión,
  la arena, la torre y los bosses. Se conserva el progreso absoluto de las
  misiones y el porcentaje de vida restante de cada enemigo. El combate
  automático pendiente se calcula antes del cambio. Las recompensas de cada
  enemigo y sus logros asociados usan el tormento más bajo en el que recibió
  daño; así no se incrementa su botín al subir el tormento justo antes de vencer.
  En enemigos ya empezados se conserva como mínimo el tormento guardado al
  actualizar. La vida y
  los fragmentos se redondean al entero más próximo; las monedas y la XP se
  redondean tras aplicar también sus bonos habituales.
- **Progresión a largo plazo:** hay logros por 7, 30, 90, 180 y 365 días
  distintos en los que se completa al menos una misión. Se cuentan a partir
  de esta actualización porque las partidas anteriores no guardaban ese
  historial; no se pierde el resto de progreso. Son objetivos de juego,
  no una recomendación de entrenar cada día.
- **Travesía:** cada tres días distintos de actividad se completa
  automáticamente uno de 52 capítulos y se reciben monedas y fragmentos.
  Los días no tienen que ser consecutivos. Con tres días de actividad
  semanales se avanza aproximadamente un capítulo a la semana durante
  un año. Los días que ya había registrados antes de esta versión cuentan:
  sus recompensas se entregan automáticamente una sola vez. Al completar los
  52 capítulos se puede comenzar otra vuelta opcional con nuevos días de
  actividad; cada vuelta adicional requiere un día de actividad más por
  capítulo y aumenta las recompensas base un 25 %.
  Los días anteriores al comienzo de una vuelta no se vuelven a recompensar.
  Desde la segunda vuelta, cada 13 capítulos se entregan fragmentos y un
  Escudo del caminante exclusivo, con los atributos de un escudo legendario
  normal. No se entregan recompensas de hitos retroactivas.

La racha se conserva aunque pasen días sin jugar y aumenta una vez por cada
día distinto de actividad. No se recuperan rachas perdidas anteriormente.

La XP necesaria para el siguiente nivel es `100 + 20 × n + 6 × n² + n³`,
donde `n` es el nivel actual menos uno. Al actualizar, la XP dentro del nivel y
la vida restante del enemigo de arena se convierten proporcionalmente una sola
vez, sin perder niveles ni objetos.

Los bonos de cada estadística se suman entre sí. Las misiones, el equipo y las
recompensas son mecánicas de juego, no un plan de entrenamiento: adapta cada
actividad a tu capacidad y detente si sientes dolor.

## Simulación de equilibrio

`node tests/balance-simulation.js` simula un año con perfiles de dos, tres y
cinco días de actividad por semana. Incluye arena sin conexión, habilidades,
pasivas, forja, fabricación y vueltas opcionales. Usa decisiones y azar
deterministas simplificados: sus resultados orientan el ajuste, pero no
predicen la progresión de todas las partidas.

## Referencias de diseño

El seguimiento de hábitos con niveles y equipo toma como inspiración general
[Habitica](https://github.com/HabitRPG/habitica); la progresión incremental,
[Gooboo](https://github.com/Tendsty/gooboo). FitQuest tiene implementación y
contenido propios.

El juego es individual: la estética y los sistemas están inspirados en MMO,
pero no hay servidor, cuentas ni multijugador. Las nuevas metas sirven como
base para la progresión anual; el equilibrio aún necesita pruebas de juego
reales a largo plazo.

## Desarrollo

Para ejecutar las pruebas de las mecánicas con Node.js: `node --test tests/game.test.js`.
Para simular tres estrategias durante 30, 90 y 365 días:
`TZ=UTC node tests/balance-simulation.js`. La simulación usa una semilla fija,
sesiones de una hora de arena en 2, 3 o 5 días por semana, 2, 3 o 4 misiones
por sesión y estrategias automáticas de inversión y tormento. Son escenarios de
juego, no recomendaciones de ejercicio; no predicen resultados de todas las
partidas ni sustituyen las pruebas con jugadores.
