import { Context } from "effect";
import * as GraphQL from "../schema";

/**
 * Compilation receives source Schema via context
 */
export const Schema = Context.GenericTag<GraphQL.Schema<GraphQL.Schema.AnyDefinition>>(`effect-graphql/source-schema`)
