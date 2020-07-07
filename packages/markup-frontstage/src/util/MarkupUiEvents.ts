import { BeUiEvent } from "@bentley/bentleyjs-core";

/** Markup frontstage UI UiEvent class is a subclass of BeEvent with argument type safety.
 * @public
 */
export class MarkupUiEvent<TEventArgs> extends BeUiEvent<TEventArgs> {}
