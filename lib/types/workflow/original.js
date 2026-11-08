/** Original-format imports use the same parser as bundled and custom workflows. */
import { parseWorkflow } from "./loader.js";
/** @param document - Original YAML. @param directory - Workflow directory. @param sourceRoot - Explicit resource root. @returns Resolved original workflow. */
export async function importOriginalWorkflow(document, directory, sourceRoot) {
    return parseWorkflow(document, directory, sourceRoot);
}
//# sourceMappingURL=original.js.map