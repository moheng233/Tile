//removeIf(production)
/*
	This file is part of Tile.

	Tile is a 2D JavaScript tile engine for the HTML5 canvas
	Copyright (C) 2015 Aaron John Schlosser

	Tile is free software; you can redistribute it and/or
	modify it under the terms of the GNU General Public License
	as published by the Free Software Foundation; either version 2
	of the License, or (at your option) any later version.

	Tile is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program; if not, write to the Free Software
	Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/
//endRemoveIf(production)

// --------------------------------------------------
// TYPES

var types = {
	'*': {
		levels: {
			water: 0
		},
		actions: ['deepen', 'info', 'move', 'grow']
	},
	grass: {
		actions: ['wetten']
	},
	dirt: {
		levels: {
			grass: 0,
			water: 0
		},
		actions: ['wetten', 'vegetate']
	},
	water: {
		flows: true,
		levels: {
			water: 9
		},
		actions: ['flood']
	},
	meadow: {
		actions: ['wetten']
	},
	town: {
		persistent: true,
		population: 500,
		growth: ['population']
	},
	city: {
		persistent: true,
		population: 500,
		growth: ['population']
	},
	farm: {
		yield: 10,
		actions: ['wetten']
	},
	player: {
		town: null,
		actions: ['player']
	}
};

// END TYPES
// --------------------------------------------------
