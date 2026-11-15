# Navegación autónoma en un almacén

Simulación para el laboratorio de Robótica de la semana 11 de la Universidad Nacional de Trujillo.

## Abrir y demostrar

1. Abre **Simulacion.html** en Chrome o Edge. El archivo incluye todo lo necesario para ejecutar la simulación sin conexión. Para la vista 3D, el navegador debe tener WebGL 2 disponible.
2. Selecciona **Obstáculo inesperado** e inicia la misión. La caja se activa a los 1,80 s de simulación. Usa **Pausar** o **Avanzar 0,25 s** para observar la detección y la parada.
3. Cambia a **Plano** para ver el camino inicial, el desvío por el paso norte y el recorrido real. Repite con **Recorrido base** y **Destino inaccesible**.
4. Al terminar, usa **Descargar registro CSV** para guardar los eventos y los indicadores de la misión. **Evidencias** contiene las cinco capturas y los registros de las tres ejecuciones verificadas.

## Publicar en Vercel

Sube el contenido de **Simulacion_Vercel** a la raíz de un repositorio de GitHub e impórtalo en Vercel como un proyecto nuevo. Si subes el repositorio completo, elige **Simulacion_Vercel** como **Root Directory**.

`vercel.json` selecciona **Other**, sirve la carpeta `public` y deja vacíos los comandos de instalación y compilación. La simulación ejecuta sus cálculos y gráficos en el navegador.

## Código fuente

El motor está en `sim/motor.js`. Calcula rutas con A* sobre una cuadrícula de cuatro vecinos, ejecuta el movimiento a un paso fijo de 1/60 s y simula un sensor frontal de tres rayos. La escena y el plano usan el mismo estado del motor.

- `npm test` ejecuta las pruebas de los tres escenarios.
- `npm start` sirve el código fuente en el puerto local 8011. En Windows también puede iniciarse con **Iniciar.cmd**.
- `npm run build` actualiza tanto **Simulacion.html** como el archivo de publicación en **Simulacion_Vercel/public** después de cambios en el código fuente.

El navegador necesita una versión reciente. Los archivos de Three.js y OrbitControls se distribuyen con su licencia MIT en `sim/vendor`.
