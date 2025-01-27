/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Viewport, ViewState } from "@itwin/core-frontend";
import { DrawingViewState, IModelApp, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import { MeasurementCachedGraphicsHandler } from "./MeasurementCachedGraphicsHandler.js";
import { WellKnownViewType } from "./MeasurementEnums.js";
import type { MeasurementViewTargetProps } from "./MeasurementProps.js";

/** Base class for view type classifiers. This returns either a well-known type or an app-defined one that measurements use identify what viewports they are compatible with (e.g. to draw in). */
export abstract class MeasurementViewTypeClassifier {
  /** Gets the type name of the viewport this corresponds to. */
  public readonly typeName: string;

  /** Gets whether this viewport type is a spatial view. */
  public readonly isSpatial: boolean;

  /** Gets whether this viewport type is a drawing view. */
  public readonly isDrawing: boolean;

  /**
   * Constructs a new MeasurementViewClassifier
   * @param typeName Name of the view that is used to identify it.
   * @param isSpatial If the view type is within the AnySpatial hierarchy.
   * @param isDrawing If the view type is within the AnyDrawing hierarchy.
   */
  public constructor(typeName: string, isSpatial: boolean, isDrawing: boolean) {
    this.typeName = typeName;
    this.isSpatial = isSpatial;
    this.isDrawing = isDrawing;
  }

  /** Classify a viewport.
   * @param vp Viewport to classify.
   * @returns True if the viewport corresponds to the class name of this classifier, false if not.
   */
  public classifyViewport(vp: Viewport): boolean {
    return this.classifyView(vp.view);
  }

  /** Classify a view state.
   * @param vs Viewstate to classify.
   * @returns True if the viewstate corresponds to the class name of this classifier, false if not.
   */
  public abstract classifyView(vs: ViewState): boolean;
}

/** Generic measurement view classifier that classifies an incoming viewstate by it's class name. */
export class ClassNameMeasurementViewTypeClassifier extends MeasurementViewTypeClassifier {
  public readonly className: string;

  /**
   * Constructs a new ClassNameMeasurementViewClassifier
   * @param typeName Name of the view that is used to identify it.
   * @param isSpatial If the view type is within the AnySpatial hierarchy.
   * @param isDrawing If the view type is within the AnyDrawing hierarchy.
   * @param viewClassname The target's viewstate's classname.
   */
  public constructor(typeName: string, isSpatial: boolean, isDrawing: boolean, viewClassname: string) {
    super(typeName, isSpatial, isDrawing);
    this.className = viewClassname;
  }

  /** Classify a view state.
   * @param vs Viewstate to classify.
   * @returns True if the viewstate corresponds to the class name of this classifier, false if not.
   */
  public classifyView(vs: ViewState): boolean {
    return vs.className === this.className;
  }
}

/**
 * Defines what type of viewports the measurement "targets". Each viewport can be classified based on its view state (or some other app-specific context)
 * and have a type name associated with it, which is used to determine what viewports the measurement will decorate at draw time. A target can include some viewports
 * and exclude others. In the majority of cases, a measurement will just target one type of viewport but complicated cases are possible, for example if a measurement
 * can draw different representations of itself in different viewports.
 */
export class MeasurementViewTarget {
  private static _classifiers = new Map<string, MeasurementViewTypeClassifier>();

  private _included: Set<string>;
  private _excluded: Set<string>;
  private _viewIds: Set<string>;

  /** Gets all the registered view classifiers. */
  public static get classifiers(): ReadonlyMap<string, MeasurementViewTypeClassifier> {
    return MeasurementViewTarget._classifiers;
  }

  /** Gets the "primary" view type which is the first included view type. If there is none, then the default is "any". The majority of cases
   * there will be a single view type, but more complex measurements may have more complicated cases where certain view type should be excluded.
   */
  public get primary(): string {
    if (this._included.size > 0) {
      for (const viewClass of this._included)
        return viewClass;
    }

    return WellKnownViewType.Any;
  }

  /** Gets the view types that a measurement will draw in. */
  public get included(): ReadonlySet<string> {
    return this._included;
  }

  /** Gets the view types that a measurement will not draw in. */
  public get excluded(): ReadonlySet<string> {
    return this._excluded;
  }

  /** Gets the viewIds that the measurement will draw in */
  public get viewIds(): ReadonlySet<string> {
    return this._viewIds;
  }

  /**
   * Constructs a new MeasurementViewTarget.
   * @param included Optional, one or more view type names where the view is valid. If none, then "Any" is the default type meaning any viewport can be valid.
   * @param excluded Optional, one or more view type names where the view is not valid.
   * @param viewIds Optional, one or more view ids where the measurement should display. If none, will not consider for display
   */
  public constructor(included?: string | string[], excluded?: string | string[], viewIds?: string | string[]) {
    this._included = new Set<string>();
    this._excluded = new Set<string>();
    this._viewIds = new Set<string>();

    if (included)
      this.include(included);

    if (excluded)
      this.exclude(excluded);

    if (viewIds)
      this.addViewIds(viewIds);
  }

  public addViewIds(viewIds: string | string[]) {
    const arr = Array.isArray(viewIds) ? viewIds : [viewIds];
    for (const id of arr) {
      this._viewIds.add(id);
    }
  }

  /**
   * Adds one or more view types to the include list.
   * @param type View types.
   */
  public include(type: string | string[]) {

    const arr = Array.isArray(type) ? type : [type];
    for (const t of arr) {
      if (t === WellKnownViewType.Any)
        continue;

      this._excluded.delete(t);
      this._included.add(t);
    }
  }

  /**
   * Adds one or more view types to the exclude list.
   * @param type View types.
   */
  public exclude(type: string | string[]) {

    const arr = Array.isArray(type) ? type : [type];
    for (const t of arr) {
      // It doesn't make sense to exclude the special cases, if the include list does not have them then the target is for a specific type of viewport anyways
      if (t === WellKnownViewType.Any || t === WellKnownViewType.AnySpatial || t === WellKnownViewType.AnyDrawing)
        continue;

      this._included.delete(t);
      this._excluded.add(t);
    }
  }

  /**
   * Adds one or more view types to either the include or exclude list.
   * @param type View types.
   * @param isIncluded True if add to the include list, false to the exclude list.
   */
  public add(type: string | string[], isIncluded: boolean = true) {
    if (isIncluded)
      this.include(type);
    else
      this.exclude(type);
  }

  /**
   * Replaces the include or exclude sets with the specified view types.
   * @param type View types.
   * @param isIncluded True if to replace the include list, false to replace the exclude list.
   */
  public replace(type: string | string[], isIncluded: boolean = true) {
    if (isIncluded) {
      this._included.clear();
      this.include(type);
    } else {
      this._excluded.clear();
      this.exclude(type);
    }
  }

  /** Clears both include and exclude lists. */
  public clear() {
    this._included.clear();
    this._excluded.clear();
    this._viewIds.clear();
  }

  /** Creates a deep copy of the view type object. */
  public clone(): MeasurementViewTarget {
    return MeasurementViewTarget.fromJSON(this.toJSON());
  }

  /** Tests if this view target is equal to the other one. Equality means they both have the same number and types of views in their include/exclude sets. */
  public equals(other: MeasurementViewTarget): boolean {
    if (this._included.size !== other._included.size || this._excluded.size !== other._excluded.size || this._viewIds.size !== other._viewIds.size)
      return false;

    for (const include of this._included) {
      if (!other.included.has(include))
        return false;
    }

    for (const exclude of this._excluded) {
      if (!other.excluded.has(exclude))
        return false;
    }

    for (const viewId of this._viewIds) {
      if (!other.viewIds.has(viewId))
        return false;
    }

    return true;
  }

  /**
   * Copies the view classes from the other view type object (completely overwrites).
   * @param other view type object.
   */
  public copyFrom(other: MeasurementViewTarget) {
    this.clear();
    this.include(Array.from(other.included));
    this.exclude(Array.from(other.excluded));
    this.addViewIds(Array.from(other.viewIds));
  }

  /**
   * Cpies the view classes from the other view type object (preserves existing data if possible).
   * @param other view type object.
   */
  public merge(other: MeasurementViewTarget) {
    this.include(Array.from(other.included));
    this.exclude(Array.from(other.excluded));
    this.addViewIds(Array.from(other.viewIds));
  }

  /**
   * Removes one or more view types from both the include or exclude lists.
   * @param type View types.
   */
  public remove(type: string | string[]) {
    const arr = Array.isArray(type) ? type : [type];
    for (const t of arr) {
      this._excluded.delete(t);
      this._included.delete(t);
    }
  }

  /**
   * Checks if the target is compatible with the specified type, meaning the type is part of the include list and not excluded. If the specified type is of the "Any" special cases,
   * then included types may be part of that hierarchy if their classifiers are Spatial/Drawing types, so this would return true in that case.
   * @param type type to check compatibility. Can be the "Any" special cases (e.g. if targets Sheet and you request AnyDrawing, this will return true).
   */
  public isOfViewType(type: string): boolean {
    // Is this type excluded?
    if (this.excluded.has(type))
      return false;

    // If included has zero entries, then it is considered as "Any" and thus is valid. And if incoming type is Any...well it's a no op...
    if (this.included.size === 0 || type === WellKnownViewType.Any)
      return true;

    // Check if the specific view class is included
    if (this.included.has(type))
      return true;

    // If incoming type is AnySpatial or AnyDrawing, we need to look at each include's classifier to see if they are compatible
    if (type === WellKnownViewType.AnyDrawing || type === WellKnownViewType.AnySpatial) {
      for (const include of this._included) {
        const classifier = MeasurementViewTarget.findClassifier(include);
        if (!classifier)
          continue;

        if (classifier.isSpatial && type === WellKnownViewType.AnySpatial)
          return true;

        if (classifier.isDrawing && type === WellKnownViewType.AnyDrawing)
          return true;
      }
    } else {
      // Otherwise incoming type is not Any*, but it isn't in the include list either. If include list has AnySpatial/AnyDrawing, look up the classifier for the given type
      // so we  can determine if it falls under either of those categories
      const classifier = MeasurementViewTarget.findClassifier(type);
      let isSpatial = false;
      let isDrawing = false;

      if (classifier) {
        isSpatial = classifier.isSpatial;
        isDrawing = classifier.isDrawing;
      }

      if (isSpatial && this.included.has(WellKnownViewType.AnySpatial))
        return true;

      if (isDrawing && this.included.has(WellKnownViewType.AnyDrawing))
        return true;
    }

    return false;
  }

  /**
   * Checks if the specified viewport is compatible with this view type.
   * @param vp Viewport to check
   * @returns true if the viewport is compatible (e.g. can draw in it).
   */
  public isViewportCompatible(vp: Viewport): boolean {
    const viewType = MeasurementViewTarget.classifyViewport(vp);

    // Is the viewId valid
    if (this._viewIds.size > 0 && !this.isValidViewId(vp.view.id))
      return false;

    // Is this type excluded?
    if (this.excluded.has(viewType))
      return false;

    // If included has zero entries, then it is considered as "Any" and thus is valid
    if (this.included.size === 0)
      return true;

    // Check the other two cases where we want to include any spatial or any drawing regardless of subclass
    const isSpatial = vp.view instanceof SpatialViewState;
    const isDrawing = vp.view instanceof DrawingViewState;

    if (isSpatial && this.included.has(WellKnownViewType.AnySpatial))
      return true;

    if (isDrawing && this.included.has(WellKnownViewType.AnyDrawing))
      return true;

    // Check if the specific view class is included
    if (this.included.has(viewType))
      return true;

    return false;
  }

  /**
   * Invalidates decorations in all appropiate viewports that are compatible with this view type.
   */
  public invalidateViewportDecorations() {
    // If empty, then "Any" so invalidate every viewport
    if (this.included.size === 0 && this.excluded.size === 0) {
      IModelApp.viewManager.invalidateDecorationsAllViews();
      MeasurementCachedGraphicsHandler.instance.invalidateDecorations();
      return;
    }

    // Go through each viewport, check if it's compatible and if so invalidate
    for (const vp of IModelApp.viewManager) {
      if (this.isViewportCompatible(vp)) {
        vp.invalidateDecorations();
        MeasurementCachedGraphicsHandler.instance.invalidateDecorations(vp);
      }
    }
  }

  /**
   * Creates a plain old JSON object with the include/exclude lists. If it is an object with empty arrays, then it allows for "Any" viewport to be compatible.
   */
  public toJSON(): MeasurementViewTargetProps {
    const included = Array.from(this._included);
    const excluded = Array.from(this._excluded);
    const viewIds = Array.from(this._viewIds);
    return { included, excluded, viewIds };
  }

  /**
   * Loads JSON data into the object instance, overwriting previous data.
   * @param props Props that contain include/exclude lists.
   */
  public loadFromJSON(props: MeasurementViewTargetProps) {
    this.clear();

    if (props.included !== undefined && Array.isArray(props.included))
      this.add(props.included, true);

    if (props.excluded !== undefined && Array.isArray(props.excluded))
      this.add(props.excluded, false);

    if (props.viewIds !== undefined && Array.isArray(props.viewIds))
      this.addViewIds(props.viewIds);
  }

  /**
   * Creates a new view type based on incoming props.
   * @param props Props that contain include/exclude lists.
   * @returns constructed view type.
   */
  public static fromJSON(props: MeasurementViewTargetProps): MeasurementViewTarget {
    return new MeasurementViewTarget(props.included, props.excluded, props.viewIds);
  }

  /**
   * Invalidate decorations for all viewports that are of the specified type.
   * @param viewType Type of view, can be any WellKnownViewType or app-defined name.
   */
  public static invalidateDecorationsForViewType(viewType: string) {
    if (viewType === WellKnownViewType.Any) {
      IModelApp.viewManager.invalidateDecorationsAllViews();
      MeasurementCachedGraphicsHandler.instance.invalidateDecorations();
      return;
    }

    for (const vp of IModelApp.viewManager) {
      let invalidate = false;

      if ((viewType === WellKnownViewType.AnySpatial && vp.view instanceof SpatialViewState) ||
        (viewType === WellKnownViewType.AnyDrawing && vp.view instanceof DrawingViewState)) {
        invalidate = true;
      }

      if (MeasurementViewTarget.classifyViewport(vp) === viewType)
        invalidate = true;

      if (invalidate) {
        vp.invalidateDecorations();
        MeasurementCachedGraphicsHandler.instance.invalidateDecorations(vp);
      }
    }
  }

  /**
   * Classifies a viewport. This will never return the special cases of "Any", "AnySpatial", "AnyDrawing", but concrete view type names.
   * @param vp Viewport to classify.
   * @returns a type name for the view, either a WellKnown view type or an app-defined one.
   */
  public static classifyViewport(vp: Viewport): string {
    for (const kv of MeasurementViewTarget._classifiers) {
      const classifier = kv[1];
      if (classifier.classifyViewport(vp))
        return classifier.typeName;
    }

    // If no classifier...do some hardcode defaults based on platform viewstates
    if (vp.view instanceof SheetViewState) {
      return WellKnownViewType.Sheet;
    } else if (vp.view instanceof DrawingViewState) {
      return WellKnownViewType.Drawing;
    }

    // Should be spatial views left anyways...
    return WellKnownViewType.Spatial;
  }

  /**
   * Adds an app-specific view classifier. This overrides any current classifiers that correspond to it's type name.
   * @param classifier Classifier to add.
   */
  public static registerClassifier(classifier: MeasurementViewTypeClassifier) {
    if (classifier.typeName === WellKnownViewType.Any || classifier.typeName === WellKnownViewType.AnySpatial || classifier.typeName === WellKnownViewType.AnyDrawing)
      throw new Error(`${classifier.typeName} is a reserved view type.`);

    MeasurementViewTarget._classifiers.set(classifier.typeName, classifier);
  }

  /**
   * Removes an app-specific view classifier.
   * @param typeName Name of the view classification to drop.
   */
  public static dropClassifier(typeName: string): boolean {
    return MeasurementViewTarget._classifiers.delete(typeName);
  }

  /**
   * Finds the associated view type classifier or the type name.
   * @param typeName Type name to find the classifier associated.
   * @returns the associated classifier or undefined if it does not exist.
   */
  public static findClassifier(typeName: string): MeasurementViewTypeClassifier | undefined {
    return MeasurementViewTarget._classifiers.get(typeName);
  }

  public isValidViewId(viewId: string) {
    if (this._viewIds.size > 0)
      return this._viewIds.has(viewId);
    else
      return true;
  }
}

// Register standard view type classifiers, these can be overridden by an app later if needed
MeasurementViewTarget.registerClassifier(new ClassNameMeasurementViewTypeClassifier(WellKnownViewType.Spatial, true, false, SpatialViewState.className));
MeasurementViewTarget.registerClassifier(new ClassNameMeasurementViewTypeClassifier(WellKnownViewType.Drawing, false, true, DrawingViewState.className));
MeasurementViewTarget.registerClassifier(new ClassNameMeasurementViewTypeClassifier(WellKnownViewType.Sheet, false, true, SheetViewState.className));

// These are from Civil-ReviewTools, if changed make sure they are changed there.
MeasurementViewTarget.registerClassifier(new ClassNameMeasurementViewTypeClassifier(WellKnownViewType.XSection, true, false, "XSectionViewDefinition"));
MeasurementViewTarget.registerClassifier(new ClassNameMeasurementViewTypeClassifier(WellKnownViewType.Profile, false, true, "ProfileSectionViewDefinition"));
