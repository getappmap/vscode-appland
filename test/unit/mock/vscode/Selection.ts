import Position from './Position';

export default class Selection {
  constructor(public readonly start: Position, public readonly end: Position) {}
}
