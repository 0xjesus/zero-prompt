let _counter = 0;
export default function getUniqueID() {
  _counter += 1;
  return "markdown_id_" + _counter;
}
